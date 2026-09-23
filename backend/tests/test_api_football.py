"""
Régression sur le connecteur API-Football.

L'hôte est injoignable depuis l'environnement de développement (le proxy refuse
le CONNECT), donc rien ici ne parle au réseau : le client est piloté par des
réponses enregistrées, aux formes que documente l'API v3. C'est suffisant pour
fixer ce qui compte, et ce qui compte n'est pas le transport.

Trois pièges sont couverts, parce que chacun produirait un dégât silencieux :

  1. **« 200 » ne veut pas dire « des données ».** API-Football répond 200 avec
     un objet `errors` quand l'offre ne couvre pas l'appel. Lire `response: []`
     et conclure « pas de xG dans cette ligue » serait un contresens coûteux :
     on renoncerait à une variante du modèle pour une raison de facturation.
  2. **Les noms d'équipe.** L'application apparie sur le nom exact. Importer
     « Manchester City » dans une compétition qui connaît « Man City » couperait
     l'historique en deux sans qu'aucun écran ne le dise.
  3. **L'étiquette des cotes.** Appeler « clôture » une cote relevée trois jours
     avant le coup d'envoi fausserait toute la calibration, qui se mesure
     précisément contre la ligne de clôture.
"""

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE))

_spec = importlib.util.spec_from_file_location(
    "fetch_api_football", RACINE / "scripts" / "fetch_api_football.py"
)
afb = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(afb)

try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    DEPENDENCIES_AVAILABLE = True
except ImportError:  # pragma: no cover - dépend de l'environnement
    DEPENDENCIES_AVAILABLE = False


def fixture(identifiant, domicile, extérieur, date, statut="FT",
            buts=(2, 1), mi_temps=(1, 0)):
    corps = {
        "fixture": {"id": identifiant, "date": date,
                    "status": {"long": "…", "short": statut}},
        "league": {"id": 39, "name": "Premier League", "season": 2025},
        "teams": {"home": {"id": 1, "name": domicile},
                  "away": {"id": 2, "name": extérieur}},
        "goals": {"home": None, "away": None},
        "score": {"halftime": {"home": None, "away": None},
                  "fulltime": {"home": None, "away": None}},
    }
    if statut in ("FT", "AET", "PEN"):
        corps["goals"] = {"home": buts[0], "away": buts[1]}
        corps["score"]["fulltime"] = {"home": buts[0], "away": buts[1]}
        corps["score"]["halftime"] = {"home": mi_temps[0], "away": mi_temps[1]}
    return corps


class TestNormalisation(unittest.TestCase):

    def test_a_played_match_becomes_a_result_row(self):
        ligne = afb.fixture_row(
            fixture(1, "Manchester City", "Arsenal", "2025-08-15T19:00:00+00:00"), "39"
        )
        self.assertEqual(ligne["Date"], "15/08/2025")
        self.assertEqual(ligne["Time"], "19:00")
        self.assertEqual((ligne["FTHG"], ligne["FTAG"], ligne["FTR"]), (2, 1, "H"))
        self.assertEqual((ligne["HTHG"], ligne["HTAG"]), (1, 0))

    def test_an_upcoming_match_has_no_score(self):
        ligne = afb.fixture_row(
            fixture(2, "Chelsea", "Everton", "2026-05-01T14:00:00+00:00", statut="NS"), "39"
        )
        self.assertEqual(ligne["FTHG"], "")
        self.assertEqual(ligne["HomeTeam"], "Chelsea")

    def test_a_postponed_match_is_dropped(self):
        """Ni joué ni programmé : l'inventer en affiche le laisserait en attente à vie."""
        for statut in ("PST", "CANC", "ABD", "SUSP"):
            with self.subTest(statut=statut):
                self.assertIsNone(afb.fixture_row(
                    fixture(3, "A", "B", "2025-09-01T12:00:00+00:00", statut=statut), "39"
                ))

    def test_extra_time_keeps_the_ninety_minute_score(self):
        """Le modèle raisonne en temps réglementaire ; un score de prolongation le fausserait."""
        brut = fixture(4, "A", "B", "2025-09-01T12:00:00+00:00", statut="AET", buts=(1, 1))
        brut["goals"] = {"home": 3, "away": 2}          # après prolongation
        brut["score"]["fulltime"] = {"home": 1, "away": 1}
        ligne = afb.fixture_row(brut, "39")
        self.assertEqual((ligne["FTHG"], ligne["FTAG"], ligne["FTR"]), (1, 1, "D"))


class TestStatistiques(unittest.TestCase):

    RÉPONSE = [
        {"team": {"id": 1, "name": "Manchester City"}, "statistics": [
            {"type": "Shots on Goal", "value": 7},
            {"type": "Total Shots", "value": 18},
            {"type": "Corner Kicks", "value": 9},
            {"type": "expected_goals", "value": "2.45"},
            {"type": "Ball Possession", "value": "64%"},
        ]},
        {"team": {"id": 2, "name": "Arsenal"}, "statistics": [
            {"type": "Shots on Goal", "value": 3},
            {"type": "Total Shots", "value": 9},
            {"type": "expected_goals", "value": "0.81"},
        ]},
    ]

    def test_statistics_land_on_the_right_side(self):
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        ligne["HomeTeam"], ligne["AwayTeam"] = "Manchester City", "Arsenal"
        ligne["_home_id"] = 1
        afb.apply_statistics(ligne, self.RÉPONSE)

        self.assertEqual((ligne["HST"], ligne["AST"]), (7, 3))
        self.assertEqual((ligne["HS"], ligne["AS"]), (18, 9))
        self.assertEqual((ligne["HXG"], ligne["AXG"]), (2.45, 0.81))
        self.assertEqual(ligne["HC"], 9)
        self.assertEqual(ligne["AC"], "", "aucun corner extérieur n'était fourni")

    def test_a_renamed_team_still_gets_its_own_statistics(self):
        """Le piège : `run()` traduit les noms vers ceux de la base AVANT de
        demander les statistiques. Un appariement par nom enverrait alors les
        deux blocs du côté extérieur, et les tirs comme le xG du domicile
        disparaîtraient sans un mot."""
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        ligne["HomeTeam"], ligne["AwayTeam"] = "Man City", "Arsenal"   # noms de la base
        ligne["_home_id"] = 1                                          # identifiant d'API-Football
        afb.apply_statistics(ligne, self.RÉPONSE)

        self.assertEqual((ligne["HST"], ligne["AST"]), (7, 3))
        self.assertEqual((ligne["HXG"], ligne["AXG"]), (2.45, 0.81))

    def test_an_unattributable_block_writes_nothing(self):
        """Sans identifiant ni nom reconnaissable, ranger au hasard serait pire que rien.

        Une statistique absente se lit dans la couverture ; une statistique
        inversée produit des forces d'équipe fausses que rien ne signale.
        """
        réponse = [
            {"team": {"name": "Club inconnu A"}, "statistics": [
                {"type": "Shots on Goal", "value": 9}]},
            {"team": {"name": "Club inconnu B"}, "statistics": [
                {"type": "Shots on Goal", "value": 2}]},
        ]
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        ligne["HomeTeam"], ligne["AwayTeam"] = "Man City", "Arsenal"
        self.assertEqual(afb.apply_statistics(ligne, réponse), [])
        self.assertEqual(ligne["HST"], "")
        self.assertEqual(ligne["AST"], "")

    def test_two_blocks_on_the_same_side_write_nothing(self):
        réponse = [
            {"team": {"id": 1, "name": "Man City"}, "statistics": [
                {"type": "Shots on Goal", "value": 9}]},
            {"team": {"id": 1, "name": "Man City"}, "statistics": [
                {"type": "Shots on Goal", "value": 2}]},
        ]
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        ligne["_home_id"] = 1
        self.assertEqual(afb.apply_statistics(ligne, réponse), [])
        self.assertEqual(ligne["HST"], "")

    def test_a_missing_value_leaves_the_column_empty(self):
        """Une statistique absente doit rester vide, jamais valoir zéro."""
        réponse = [{"team": {"id": 1, "name": "Manchester City"}, "statistics": [
            {"type": "expected_goals", "value": None},
            {"type": "Shots on Goal", "value": 5},
        ]}]
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        ligne["_home_id"] = 1
        afb.apply_statistics(ligne, réponse)
        self.assertEqual(ligne["HXG"], "")
        self.assertEqual(ligne["HST"], 5)


class TestCotes(unittest.TestCase):

    def réponse(self):
        def book(nom, domicile, nul, extérieur):
            return {"name": nom, "bets": [
                {"name": "Match Winner", "values": [
                    {"value": "Home", "odd": str(domicile)},
                    {"value": "Draw", "odd": str(nul)},
                    {"value": "Away", "odd": str(extérieur)}]},
                {"name": "Goals Over/Under", "values": [
                    {"value": "Over 2.5", "odd": "1.75"},
                    {"value": "Under 2.5", "odd": "2.10"}]},
            ]}
        return [{"bookmakers": [
            book("Pinnacle", 1.55, 4.20, 5.50),
            book("Bet365", 1.53, 4.00, 5.25),
            {"name": "Inconnu SA", "bets": []},
        ]}]

    def test_opening_is_the_default(self):
        """Une cote relevée avant le jour du match n'est pas une cote de clôture."""
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        books = afb.apply_odds(ligne, self.réponse(), closing=False)

        self.assertEqual(ligne["PSH"], 1.55)
        self.assertEqual(ligne["PSCH"], "", "la colonne de clôture doit rester vide")
        self.assertIn("Pinnacle", books)

    def test_closing_is_explicit(self):
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        afb.apply_odds(ligne, self.réponse(), closing=True)
        self.assertEqual(ligne["PSCH"], 1.55)
        self.assertEqual(ligne["PSH"], "")

    def test_average_and_best_come_from_complete_lines_only(self):
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        afb.apply_odds(ligne, self.réponse(), closing=False)
        self.assertEqual(ligne["MaxH"], 1.55)
        self.assertAlmostEqual(ligne["AvgH"], round((1.55 + 1.53) / 2, 3))
        self.assertAlmostEqual(ligne["AvgD"], round((4.20 + 4.00) / 2, 3))

    def test_an_incomplete_line_is_ignored(self):
        """Sans les trois issues du même book, ni marge ni dévigorisation n'ont de sens."""
        réponse = [{"bookmakers": [{"name": "Pinnacle", "bets": [
            {"name": "Match Winner", "values": [{"value": "Home", "odd": "1.55"}]},
        ]}]}]
        ligne = {c: "" for c in afb.CSV_COLUMNS}
        books = afb.apply_odds(ligne, réponse, closing=False)
        self.assertEqual(ligne["PSH"], "")
        self.assertEqual(books, [])


class TestClientÉconome(unittest.TestCase):

    def setUp(self):
        self.cache = Path(tempfile.mkdtemp())

    def client(self, budget=10):
        return afb.ApiFootball("clé-de-test", budget=budget, cache_dir=self.cache)

    def réponse_http(self, charge):
        faux = mock.MagicMock()
        faux.__enter__.return_value = faux
        faux.read.return_value = json.dumps(charge).encode()
        faux.headers = {"x-ratelimit-requests-remaining": "42"}
        return faux

    def test_a_plan_refusal_is_not_an_empty_result(self):
        """Le piège central : HTTP 200, `response: []`, et un refus dans `errors`."""
        charge = {"errors": {"plan": "Your plan does not have access to this endpoint"},
                  "results": 0, "response": []}
        with mock.patch("urllib.request.urlopen",
                        return_value=self.réponse_http(charge)), \
             mock.patch.object(afb.json, "load", side_effect=lambda f: charge):
            with self.assertRaises(afb.PlanError):
                self.client().get("odds", {"fixture": 1})

    def test_a_quota_refusal_is_named(self):
        charge = {"errors": {"requests": "You have reached the request limit for the day"},
                  "response": []}
        with mock.patch("urllib.request.urlopen",
                        return_value=self.réponse_http(charge)), \
             mock.patch.object(afb.json, "load", side_effect=lambda f: charge):
            with self.assertRaises(afb.QuotaError):
                self.client().get("fixtures", {"league": 39})

    def test_the_cache_spends_no_quota(self):
        """Sans cela, chaque relance rebrûlerait plusieurs jours de quota."""
        charge = {"errors": [], "response": [{"ok": True}], "paging": {"total": 1}}
        client = self.client()
        with mock.patch("urllib.request.urlopen",
                        return_value=self.réponse_http(charge)), \
             mock.patch.object(afb.json, "load", side_effect=lambda f: charge), \
             mock.patch.object(afb.time, "sleep"):
            client.get("fixtures", {"league": 39})
            client.get("fixtures", {"league": 39})
        self.assertEqual(client.spent, 1)
        self.assertEqual(client.served, 1)

    def test_the_budget_stops_before_the_tier_does(self):
        charge = {"errors": [], "response": [], "paging": {"total": 1}}
        client = self.client(budget=2)
        with mock.patch("urllib.request.urlopen",
                        return_value=self.réponse_http(charge)), \
             mock.patch.object(afb.json, "load", side_effect=lambda f: charge), \
             mock.patch.object(afb.time, "sleep"):
            client.get("fixtures/statistics", {"fixture": 1})
            client.get("fixtures/statistics", {"fixture": 2})
            with self.assertRaises(afb.BudgetExhausted):
                client.get("fixtures/statistics", {"fixture": 3})


class TestNomsDÉquipe(unittest.TestCase):

    BASE = ["Man City", "Arsenal", "Nott'm Forest", "Wolves", "Tottenham"]

    def test_identical_names_match(self):
        sûres, orphelins, propositions = afb.build_team_mapping(
            ["Arsenal"], self.BASE, {})
        self.assertEqual(sûres, {"Arsenal": "Arsenal"})
        self.assertEqual((orphelins, propositions), ([], {}))

    def test_a_decoration_is_stripped(self):
        """« Tottenham Hotspur FC » et « Tottenham » sont la même équipe."""
        sûres, _, _ = afb.build_team_mapping(["Tottenham FC"], self.BASE, {})
        self.assertEqual(sûres.get("Tottenham FC"), "Tottenham")

    def test_a_different_name_is_proposed_never_applied(self):
        """Une ressemblance reste une hypothèse : elle se relit, elle ne s'impose pas."""
        sûres, orphelins, propositions = afb.build_team_mapping(
            ["Manchester City"], self.BASE, {})
        self.assertNotIn("Manchester City", sûres)
        self.assertTrue(propositions or orphelins,
                        "un nom non identique doit être signalé, pas absorbé")

    def test_an_alias_is_honoured(self):
        sûres, orphelins, propositions = afb.build_team_mapping(
            ["Manchester City"], self.BASE, {"Manchester City": "Man City"})
        self.assertEqual(sûres, {"Manchester City": "Man City"})
        self.assertEqual((orphelins, propositions), ([], {}))

    def test_an_unknown_club_is_left_unmatched(self):
        sûres, orphelins, _ = afb.build_team_mapping(
            ["Real Madrid"], self.BASE, {})
        self.assertEqual(sûres, {})
        self.assertIn("Real Madrid", orphelins)


class TestCouverture(unittest.TestCase):

    def test_coverage_counts_what_is_actually_there(self):
        vide = {c: "" for c in afb.CSV_COLUMNS}
        avec_xg = dict(vide, FTHG=2, HXG=1.4, AXG=0.9)
        sans_xg = dict(vide, FTHG=0)
        rapport = afb.coverage_report([avec_xg, sans_xg])
        self.assertEqual(rapport["score"], (2, 2))
        self.assertEqual(rapport["xG"], (1, 2))

    def test_upcoming_rows_are_not_blamed_for_missing_a_score(self):
        """Une affiche à venir n'a ni score ni tirs : l'annoncer à 0 % serait un
        reproche adressé à la source pour une donnée qu'elle ne peut pas avoir."""
        vide = {c: "" for c in afb.CSV_COLUMNS}
        affiche = dict(vide, AvgH=2.1, AvgD=3.4, AvgA=3.6)
        rapport = afb.coverage_report([affiche], upcoming=True)
        self.assertNotIn("score", rapport)
        self.assertNotIn("xG", rapport)
        self.assertEqual(rapport["cotes 1X2"], (1, 1))


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TestChaîneComplète(unittest.TestCase):
    """Du JSON d'API-Football jusqu'au xG lisible en base, sans le réseau."""

    def setUp(self):
        self.db_path = tempfile.mktemp(suffix=".db")
        os.environ["DATABASE_URL"] = f"sqlite:///{self.db_path}"
        from app import database
        database.engine = create_engine(os.environ["DATABASE_URL"],
                                        connect_args={"check_same_thread": False})
        database.SessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                             bind=database.engine)
        from app import models_sport
        from app.router_sport import router
        self.models, self.database = models_sport, database
        models_sport.Base.metadata.create_all(bind=database.engine)
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def test_xg_survives_all_the_way_into_the_database(self):
        ligne = afb.fixture_row(
            fixture(1, "Manchester City", "Arsenal", "2025-08-15T19:00:00+00:00"), "39")
        # Comme dans `run()` : le nom est d'abord traduit vers celui de la base,
        # puis les statistiques arrivent, appariées sur l'identifiant.
        ligne["HomeTeam"] = "Man City"
        afb.apply_statistics(ligne, TestStatistiques.RÉPONSE)
        ligne.pop("_home_id", None)

        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": afb.to_csv([ligne]), "import_odds": True,
        })
        self.assertEqual(réponse.status_code, 200, réponse.text)
        self.assertEqual(réponse.json()["created"], 1)

        session = self.database.SessionLocal()
        try:
            match = session.query(self.models.SportMatch).one()
            self.assertEqual((match.home_goals, match.away_goals), (2, 1))
            self.assertAlmostEqual(match.home_xg, 2.45)
            self.assertAlmostEqual(match.away_xg, 0.81)
            self.assertEqual(match.home_shots_on_target, 7)
        finally:
            session.close()

    def test_a_second_source_fills_the_gaps_of_the_first(self):
        """L'appariement qui donne tout son intérêt au connecteur.

        Le banc d'essai a besoin, sur les **mêmes** matchs, de la cote de
        clôture (football-data.co.uk l'a, API-Football non) et du xG
        (API-Football l'a, football-data.co.uk non). Si le second import se
        contentait d'ignorer un match déjà connu, le xG serait perdu en silence
        et la couverture annoncée par le script ne correspondrait à rien.
        """
        entête_odds = ("Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HST,AST,"
                       "PSCH,PSCD,PSCA")
        premier = (f"{entête_odds}\n"
                   "E0,15/08/2025,19:00,Man City,Arsenal,2,1,H,5,4,1.55,4.20,5.50")
        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": premier, "import_odds": True,
        })
        self.assertEqual(réponse.json()["created"], 1)

        # Même match, vu par API-Football : il apporte le xG et les tirs totaux,
        # et ses tirs cadrés diffèrent — la valeur déjà en base doit l'emporter.
        second = ("Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HS,AS,HST,AST,HXG,AXG\n"
                  "39,15/08/2025,19:00,Man City,Arsenal,2,1,H,18,9,7,3,2.45,0.81")
        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": second, "import_odds": False,
        })
        données = réponse.json()
        self.assertEqual(données["created"], 0, "un doublon a été créé")
        self.assertEqual(données["enriched"], 1)

        session = self.database.SessionLocal()
        try:
            match = session.query(self.models.SportMatch).one()
            self.assertAlmostEqual(match.home_xg, 2.45, msg="le xG a été perdu")
            self.assertEqual(match.home_shots, 18, "les tirs totaux manquants")
            self.assertEqual(
                match.home_shots_on_target, 5,
                "la seconde source a réécrit une valeur que la première avait donnée",
            )
        finally:
            session.close()

        # Rejouer le même fichier n'apporte plus rien, et le dit.
        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": second, "import_odds": False,
        })
        self.assertEqual(réponse.json()["enriched"], 0)
        self.assertEqual(réponse.json()["skipped"], 1)

    def test_the_same_row_twice_in_one_file_counts_once(self):
        """Le compteur décrit ce que la ligne apporte, pas l'état de la session."""
        entête = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR"
        self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": f"{entête}\nE0,15/08/2025,19:00,Man City,Arsenal,2,1,H",
        })
        enrichi = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HXG,AXG"
        ligne = "39,15/08/2025,19:00,Man City,Arsenal,2,1,H,2.45,0.81"
        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": f"{enrichi}\n{ligne}\n{ligne}",
        })
        données = réponse.json()
        self.assertEqual(données["enriched"], 1, "la répétition a été comptée comme un apport")
        self.assertEqual(données["skipped"], 1)

    def test_a_score_disagreement_is_reported_not_arbitrated(self):
        """Trancher au hasard selon l'ordre des imports serait une décision cachée."""
        entête = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HXG,AXG"
        self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": f"{entête}\nE0,15/08/2025,19:00,Man City,Arsenal,2,1,H,,",
        })
        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": f"{entête}\n39,15/08/2025,19:00,Man City,Arsenal,3,0,H,2.4,0.7",
        })
        données = réponse.json()
        self.assertIn("score divergent", " ".join(données["errors"]))

        session = self.database.SessionLocal()
        try:
            match = session.query(self.models.SportMatch).one()
            self.assertEqual((match.home_goals, match.away_goals), (2, 1),
                             "le score en base doit rester l'ancre du dédoublonnage")
            self.assertAlmostEqual(match.home_xg, 2.4, msg="le reste s'enrichit quand même")
        finally:
            session.close()

    def test_an_upcoming_fixture_with_odds_feeds_the_journal(self):
        demain = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()
        ligne = afb.fixture_row(
            fixture(2, "Man City", "Arsenal", demain, statut="NS"), "39")
        afb.apply_odds(ligne, TestCotes().réponse(), closing=False)
        ligne.pop("_home_id", None)

        réponse = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": "2025/2026",
            "csv_text": afb.to_csv([ligne]), "import_odds": True,
        })
        self.assertEqual(réponse.status_code, 200, réponse.text)
        données = réponse.json()
        self.assertEqual(données["scheduled_created"], 1)
        self.assertGreater(données["odds_created"], 0)
        self.assertEqual(données["closing_odds_created"], 0,
                         "des cotes d'ouverture ont été enregistrées comme clôture")


if __name__ == "__main__":
    unittest.main()
