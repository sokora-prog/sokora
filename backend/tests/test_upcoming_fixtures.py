"""
Régression sur le chemin qui alimente le journal de prévisions.

Le journal est la seule mesure que le projet ne peut pas embellir : les
prévisions sont figées avant le coup d'envoi et ne sont jamais réécrites. Encore
faut-il pouvoir les figer — et c'était impossible, parce que l'import marquait
toute ligne `FINISHED` et que les fichiers de saison de football-data.co.uk ne
contiennent que des matchs joués. Le bouton « Geler les matchs à venir » ne
gelait donc rien, en annonçant deux causes dont aucune n'était la vraie.

Ce fichier fixe les quatre promesses de ce chemin :
  1. un fichier d'affiches (sans colonne de score) devient des matchs programmés ;
  2. le gel refuse de travailler sans passé, plutôt que de figer un tirage ;
  3. le résultat qui arrive ensuite complète l'affiche au lieu de la dupliquer,
     et note au passage les prévisions gelées ;
  4. quand rien n'est gelé, l'API nomme la cause réelle.
"""

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    DEPENDENCIES_AVAILABLE = True
except ImportError:  # pragma: no cover - dépend de l'environnement
    DEPENDENCIES_AVAILABLE = False

#: Colonnes d'un fichier de résultats — le score y est, les cotes de clôture aussi.
RESULT_HEADER = (
    "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HST,AST,"
    "B365H,B365D,B365A,AvgH,AvgD,AvgA,B365>2.5,B365<2.5,"
    "PSCH,PSCD,PSCA,AvgCH,AvgCD,AvgCA,B365C>2.5,B365C<2.5"
)
#: Colonnes de `fixtures.csv` : ni FTHG ni FTAG, seulement l'affiche et ses cotes.
FIXTURE_HEADER = (
    "Div,Date,Time,HomeTeam,AwayTeam,"
    "B365H,B365D,B365A,AvgH,AvgD,AvgA,B365>2.5,B365<2.5"
)

EQUIPES = ["Arsenal", "Liverpool", "Man City", "Chelsea", "Tottenham", "Everton"]


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TestUpcomingFixtures(unittest.TestCase):

    def setUp(self):
        self.db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite:///{self.db_path}"
        os.environ["DATABASE_URL"] = url

        from app import database
        database.engine = create_engine(url, connect_args={"check_same_thread": False})
        database.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=database.engine
        )
        from app import models_sport
        from app.router_sport import router

        self.models = models_sport
        self.database = database
        models_sport.Base.metadata.create_all(bind=database.engine)
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    # ── fabrication des fichiers ────────────────────────────────────────────

    def history_csv(self, matchs=60):
        """Saison en cours : assez de rencontres jouées pour que le modèle ait un avis."""
        lignes = [RESULT_HEADER]
        jour = datetime.now(timezone.utc) - timedelta(days=matchs + 10)
        for i in range(matchs):
            home = EQUIPES[i % len(EQUIPES)]
            away = EQUIPES[(i + 1 + i // len(EQUIPES)) % len(EQUIPES)]
            if home == away:
                away = EQUIPES[(i + 2) % len(EQUIPES)]
            jour += timedelta(days=1)
            hg, ag = (i % 4), ((i + 1) % 3)
            lignes.append(
                f"E0,{jour.strftime('%d/%m/%Y')},16:00,{home},{away},{hg},{ag},"
                f"{'H' if hg > ag else ('A' if ag > hg else 'D')},5,4,"
                "2.10,3.40,3.60,2.08,3.38,3.55,1.90,1.95,"
                "2.12,3.42,3.58,2.09,3.39,3.56,1.91,1.96"
            )
        return "\n".join(lignes)

    def fixtures_csv(self, jours=3, heure="20:00"):
        """Affiches à venir, au format `fixtures.csv` : pas de colonne de score."""
        lignes = [FIXTURE_HEADER]
        for i in range(jours):
            jour = datetime.now(timezone.utc) + timedelta(days=i + 2)
            home, away = EQUIPES[i * 2], EQUIPES[i * 2 + 1]
            lignes.append(
                f"E0,{jour.strftime('%d/%m/%Y')},{heure},{home},{away},"
                "2.20,3.30,3.40,2.18,3.28,3.38,1.88,1.98"
            )
        return "\n".join(lignes)

    def results_for_fixtures(self, jours=3, heure="18:30"):
        """Les mêmes affiches, une fois jouées — avec une heure qui a bougé."""
        lignes = [RESULT_HEADER]
        for i in range(jours):
            jour = datetime.now(timezone.utc) + timedelta(days=i + 2)
            home, away = EQUIPES[i * 2], EQUIPES[i * 2 + 1]
            lignes.append(
                f"E0,{jour.strftime('%d/%m/%Y')},{heure},{home},{away},2,1,H,7,3,"
                "2.20,3.30,3.40,2.18,3.28,3.38,1.88,1.98,"
                "2.22,3.32,3.42,2.19,3.29,3.39,1.89,1.99"
            )
        return "\n".join(lignes)

    def importer(self, csv_text, season="2025/2026"):
        response = self.client.post("/sport/matches/import", json={
            "competition_name": "Premier League", "season": season,
            "csv_text": csv_text, "import_odds": True,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def geler(self, **options):
        body = {"markets": ["1X2", "OU_2.5"], "signal": "goals", "market_weight": 0}
        body.update(options)
        response = self.client.post("/sport/forecasts/snapshot", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def count(self, model):
        session = self.database.SessionLocal()
        try:
            return session.query(model).count()
        finally:
            session.close()

    # ── 1. les affiches entrent en base ─────────────────────────────────────

    def test_a_file_without_goal_columns_imports_as_scheduled(self):
        """`fixtures.csv` n'a ni FTHG ni FTAG : l'import ne doit pas le rejeter."""
        result = self.importer(self.fixtures_csv())

        self.assertEqual(result["scheduled_created"], 3)
        self.assertEqual(result["created"], 0, "une affiche n'est pas un match joué")
        self.assertEqual(result["skipped"], 0, result["errors"])
        self.assertGreater(result["odds_created"], 0, "les cotes de l'affiche sont perdues")

        session = self.database.SessionLocal()
        try:
            statuts = {m.status for m in session.query(self.models.SportMatch).all()}
            self.assertEqual(statuts, {self.models.MatchStatus.SCHEDULED})
            # L'heure annoncée doit survivre : le gel refuse tout coup d'envoi
            # passé, et un match du soir ramené à minuit serait écarté.
            heures = {m.kickoff.hour for m in session.query(self.models.SportMatch).all()}
            self.assertEqual(heures, {20})
        finally:
            session.close()

    def test_a_scoreless_row_in_the_past_is_refused(self):
        """Sans score et déjà daté d'hier, ce n'est pas une affiche : c'est un trou."""
        hier = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%d/%m/%Y")
        csv_text = (
            f"{FIXTURE_HEADER}\n"
            f"E0,{hier},20:00,Arsenal,Liverpool,2.20,3.30,3.40,2.18,3.28,3.38,1.88,1.98"
        )
        result = self.importer(csv_text)

        self.assertEqual(result["scheduled_created"], 0)
        self.assertEqual(result["skipped"], 1)
        self.assertIn("déjà joué", " ".join(result["errors"]))

    # ── 2. le gel refuse de figer un tirage ─────────────────────────────────

    def test_freezing_refuses_a_competition_without_history(self):
        """Une prévision sans passé n'est pas une prévision, et ne s'effacera jamais."""
        self.importer(self.fixtures_csv())
        result = self.geler()

        self.assertEqual(result["created"], 0)
        self.assertEqual(result["scheduled_total"], 3)
        self.assertEqual(result["skipped"]["not_enough_history"], 3)
        self.assertIn("moins de", result["note"])
        self.assertEqual(self.count(self.models.SportForecast), 0)

    def test_freezing_works_once_the_season_has_a_past(self):
        self.importer(self.history_csv())
        self.importer(self.fixtures_csv())
        result = self.geler()

        self.assertGreater(result["created"], 0, result["note"])
        self.assertEqual(result["matches_covered"], 3)
        self.assertEqual(result["skipped"]["not_enough_history"], 0)
        self.assertEqual(self.count(self.models.SportForecast), result["created"])

    def test_freezing_twice_adds_nothing(self):
        """Une prévision gelée n'est jamais réécrite, même si le modèle a changé d'avis."""
        self.importer(self.history_csv())
        self.importer(self.fixtures_csv())
        premier = self.geler()
        second = self.geler()

        self.assertEqual(second["created"], 0)
        self.assertEqual(second["skipped"]["already_frozen"], premier["created"])
        self.assertIn("déjà gelées", second["note"])
        self.assertEqual(self.count(self.models.SportForecast), premier["created"])

    # ── 3. le résultat complète l'affiche et note les prévisions ────────────

    def test_the_result_completes_the_fixture_and_grades_its_forecasts(self):
        self.importer(self.history_csv())
        self.importer(self.fixtures_csv())
        gel = self.geler()
        self.assertGreater(gel["created"], 0)
        matchs_avant = self.count(self.models.SportMatch)

        # L'heure du coup d'envoi a bougé entre l'annonce et le résultat : le
        # match doit tout de même être reconnu, à la journée près.
        result = self.importer(self.results_for_fixtures())

        self.assertEqual(result["completed_from_scheduled"], 3)
        self.assertEqual(result["created"], 0, "le résultat a créé un match en doublon")
        self.assertEqual(self.count(self.models.SportMatch), matchs_avant)
        self.assertEqual(
            result["resolved_forecasts"], gel["created"],
            "des prévisions gelées restent en attente alors que le match est joué",
        )

        session = self.database.SessionLocal()
        try:
            en_attente = session.query(self.models.SportForecast).filter(
                self.models.SportForecast.outcome.is_(None)
            ).count()
            self.assertEqual(en_attente, 0)
            # Les cotes de clôture du fichier de résultats s'ajoutent à celles
            # d'ouverture de l'affiche, sans les dupliquer.
            doublons = session.execute(text(
                "SELECT COUNT(*) FROM (SELECT match_id, market, selection, "
                "bookmaker, is_closing, COUNT(*) n FROM sport_odds_quotes "
                "GROUP BY 1,2,3,4,5 HAVING n > 1)"
            )).scalar()
            self.assertEqual(doublons, 0, "la même cote a été enregistrée deux fois")
        finally:
            session.close()

    def test_the_grade_uses_the_closing_line_not_the_opening_one(self):
        """La cote écrite à la notation doit venir du fichier de résultats.

        L'affiche apporte les cotes d'ouverture, le résultat celles de clôture.
        Si la notation lit la collection chargée avant l'écriture, elle
        enregistre l'ouverture sous le nom de la clôture : le journal mesure
        alors son CLV contre la mauvaise ligne, et rien ne le signale.
        """
        entête = "Div,Date,Time,HomeTeam,AwayTeam,PSH,PSD,PSA"
        jour = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%d/%m/%Y")
        self.importer(self.history_csv())
        self.importer(f"{entête}\nE0,{jour},20:00,Arsenal,Liverpool,5.00,5.00,5.00")
        self.geler(markets=["1X2"])

        # Clôture très éloignée de l'ouverture : impossible de les confondre.
        self.importer(
            "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,PSH,PSD,PSA,PSCH,PSCD,PSCA\n"
            f"E0,{jour},18:30,Arsenal,Liverpool,2,1,H,5.00,5.00,5.00,1.50,1.50,1.50"
        )

        session = self.database.SessionLocal()
        try:
            cotes = {
                f.closing_odds for f in session.query(self.models.SportForecast).filter(
                    self.models.SportForecast.market == "1X2",
                    self.models.SportForecast.outcome.isnot(None),
                ).all()
            }
            self.assertEqual(
                cotes, {1.50},
                "la cote d'ouverture a été enregistrée comme cote de clôture",
            )
        finally:
            session.close()

    def test_the_journal_answers_once_the_forecasts_are_graded(self):
        self.importer(self.history_csv())
        self.importer(self.fixtures_csv())
        self.geler()
        self.importer(self.results_for_fixtures())

        board = self.client.get("/sport/forecasts/scoreboard")
        self.assertEqual(board.status_code, 200, board.text)
        data = board.json()
        self.assertEqual(data["pending"], 0)
        self.assertGreater(data["resolved"], 0)
        # Trois matchs ne prouvent rien, et le journal doit le dire plutôt que
        # de délivrer un verdict flatteur sur un échantillon minuscule.
        self.assertFalse(data["report"]["conclusive"])

    # ── 4. un gel qui ne gèle rien nomme la vraie cause ─────────────────────

    def test_a_results_only_database_says_so(self):
        """Le cas de l'utilisateur : sept saisons importées, aucun match à venir."""
        self.importer(self.history_csv())
        result = self.geler()

        self.assertEqual(result["created"], 0)
        self.assertEqual(result["scheduled_total"], 0)
        self.assertIn("aucun match à venir", result["note"])
        self.assertIn("fixtures.csv", result["note"])
        # Les causes que l'ancien message avançait sont justement fausses ici.
        self.assertEqual(result["skipped"]["already_frozen"], 0)
        self.assertEqual(result["skipped"]["no_odds"], 0)

    def test_a_results_only_import_says_the_journal_stays_empty(self):
        result = self.importer(self.history_csv())
        self.assertEqual(result["scheduled_created"], 0)
        self.assertIn("fixtures.csv", result["schedule_note"])

    def test_upcoming_matches_without_odds_say_so(self):
        """Sans cote, il n'y a pas de marché à battre — donc rien à mesurer."""
        self.importer(self.history_csv())
        result = self.importer(
            "Div,Date,Time,HomeTeam,AwayTeam\n"
            f"E0,{(datetime.now(timezone.utc) + timedelta(days=4)).strftime('%d/%m/%Y')},"
            "20:00,Arsenal,Liverpool"
        )
        self.assertEqual(result["scheduled_created"], 1)

        gel = self.geler()
        self.assertEqual(gel["created"], 0)
        self.assertEqual(gel["skipped"]["no_odds"], 1)
        self.assertIn("aucune cote", gel["note"])


if __name__ == "__main__":
    unittest.main()
