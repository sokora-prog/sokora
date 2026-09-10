"""
Régression sur l'import du format football-data.co.uk.

Ce fichier est le seul du dossier à dépendre de FastAPI et SQLAlchemy — ce que
le backend exige de toute façon. Il se désactive proprement si ces bibliothèques
manquent, pour que `python3 -m unittest discover -s tests` reste utilisable sur
une machine nue.

Ce qui est vérifié : les colonnes de cotes du format réel, la distinction
ouverture / clôture, la ligne de handicap en quart de but, et le fait que le
modèle sait coter cette ligne une fois importée.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    DEPENDENCIES_AVAILABLE = True
except ImportError:  # pragma: no cover - dépend de l'environnement
    DEPENDENCIES_AVAILABLE = False

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "fixtures", "football_data_sample.csv")


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TestFootballDataImport(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite:///{cls.db_path}"
        os.environ["DATABASE_URL"] = url

        from app import database
        database.engine = create_engine(url, connect_args={"check_same_thread": False})
        database.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=database.engine
        )
        from app import models_sport
        from app.router_sport import router

        models_sport.Base.metadata.create_all(bind=database.engine)
        app = FastAPI()
        app.include_router(router)
        cls.client = TestClient(app)
        cls.csv_text = open(FIXTURE, encoding="utf-8").read()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_path):
            os.unlink(cls.db_path)

    def import_csv(self, name, **options):
        response = self.client.post("/sport/matches/import", json={
            "competition_name": name, "csv_text": self.csv_text, **options,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_columns_of_the_real_format_are_recognised(self):
        from app.router_sport import FOOTBALL_DATA_ODDS
        header = open(FIXTURE, encoding="utf-8").readline().strip().split(",")
        recognised = [c for c in header if c in FOOTBALL_DATA_ODDS]
        # 1X2 et plus/moins, à l'ouverture comme à la clôture.
        self.assertGreater(len(recognised), 30)
        for column in ("PSCH", "PSCD", "PSCA", "AvgCH", "MaxCH", "PC>2.5", "AvgC>2.5"):
            self.assertIn(column, header)
            self.assertIn(column, FOOTBALL_DATA_ODDS)
        self.assertEqual(FOOTBALL_DATA_ODDS["PSCH"], ("1X2", "HOME", "Pinnacle", True))
        self.assertEqual(FOOTBALL_DATA_ODDS["PSH"], ("1X2", "HOME", "Pinnacle", False))

    def test_matches_and_odds_are_imported(self):
        result = self.import_csv("Import Complet")
        self.assertEqual(result["created"], 12)
        self.assertGreater(result["odds_created"], 0)
        self.assertGreater(result["closing_odds_created"], 0)
        # Autant de cotes d'ouverture que de clôture dans ce format.
        self.assertEqual(result["odds_created"], 2 * result["closing_odds_created"])
        self.assertIn("clôture", result["odds_note"])

    def test_reimport_creates_no_duplicate(self):
        first = self.import_csv("Idempotence")
        second = self.import_csv("Idempotence")
        self.assertEqual(first["created"], 12)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["odds_created"], 0)

    def test_markets_stored_include_the_quarter_handicap(self):
        result = self.import_csv("Marchés")
        matches = self.client.get(
            f"/sport/matches?competition_id={result['competition_id']}&limit=1"
        ).json()
        odds = self.client.get(f"/sport/matches/{matches[0]['id']}/odds").json()
        markets = set(odds["markets"])
        self.assertIn("1X2", markets)
        self.assertIn("OU_2.5", markets)
        handicaps = [m for m in markets if m.startswith("AH_")]
        self.assertEqual(len(handicaps), 1, markets)

        # La marge est calculée par bookmaker : jamais la somme de tous.
        self.assertLess(odds["margins"]["1X2"], 0.20)
        self.assertTrue(odds["margin_detail"]["1X2"])
        for detail in odds["margin_detail"]["1X2"]:
            self.assertEqual(detail["selections"], 3)

    def test_pinnacle_closing_line_is_complete(self):
        result = self.import_csv("Pinnacle")
        matches = self.client.get(
            f"/sport/matches?competition_id={result['competition_id']}&limit=1"
        ).json()
        odds = self.client.get(f"/sport/matches/{matches[0]['id']}/odds").json()
        closing = [
            row for row in odds["markets"]["1X2"]
            if row["bookmaker"] == "Pinnacle" and row["is_closing"]
        ]
        self.assertEqual(len(closing), 3)
        self.assertEqual({row["selection"] for row in closing}, {"HOME", "DRAW", "AWAY"})

    def test_imported_handicap_line_is_priced_by_the_model(self):
        result = self.import_csv("Cotation")
        matches = self.client.get(
            f"/sport/matches?competition_id={result['competition_id']}&limit=1"
        ).json()
        match_id = matches[0]["id"]
        odds = self.client.get(f"/sport/matches/{match_id}/odds").json()
        handicap = next(m for m in odds["markets"] if m.startswith("AH_"))
        analysis = self.client.get(f"/sport/matches/{match_id}/analysis").json()
        self.assertIn(handicap, analysis["markets"])
        self.assertAlmostEqual(
            sum(analysis["markets"][handicap].values()), 1.0, places=3
        )

    def test_market_opinion_is_read_on_the_reference_book(self):
        result = self.import_csv("Référence")
        matches = self.client.get(
            f"/sport/matches?competition_id={result['competition_id']}&limit=1"
        ).json()
        analysis = self.client.get(
            f"/sport/matches/{matches[0]['id']}/analysis"
        ).json()
        self.assertTrue(analysis["value_bets"])
        for bet in analysis["value_bets"]:
            self.assertEqual(bet["market_source"], "Pinnacle")
            # La mise se joue à la meilleure cote, jamais chez la référence.
            self.assertIn(bet["bookmaker"], ("Meilleure", "Pinnacle", "Moyenne"))
            self.assertLess(bet["bookmaker_margin"], 0.15)

    def test_import_options(self):
        closing_only = self.import_csv(
            "Clôture seule", closing_odds_only=True, odds_bookmakers=["Pinnacle"]
        )
        self.assertEqual(
            closing_only["odds_created"], closing_only["closing_odds_created"]
        )
        without = self.import_csv("Sans cotes", import_odds=False)
        self.assertEqual(without["odds_created"], 0)
        self.assertEqual(without["odds_bookmakers"], [])

    def test_legacy_betbrain_columns(self):
        legacy = (
            "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,BbAvH,BbAvD,BbAvA,BbAv>2.5,BbAv<2.5\n"
            "E0,11/08/2018,Arsenal,Chelsea,2,1,2.50,3.40,2.80,1.85,1.95\n"
        )
        response = self.client.post("/sport/matches/import", json={
            "competition_name": "Ancien format", "csv_text": legacy,
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["created"], 1)
        self.assertEqual(result["odds_created"], 5)
        # Ces anciennes colonnes ne contiennent aucune cote de clôture.
        self.assertEqual(result["closing_odds_created"], 0)
        self.assertIn("Aucune cote de clôture", result["odds_note"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
