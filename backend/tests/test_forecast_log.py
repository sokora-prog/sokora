"""
Régression sur le journal de prévisions gelées.

Le point vérifié ici n'est pas la qualité des prévisions, mais la solidité du
dispositif : une prévision enregistrée avant le coup d'envoi ne doit jamais
pouvoir être réécrite, un match déjà commencé ne doit jamais en fonder une, et
la notation doit être automatique et fidèle au score.

Dépend de FastAPI et SQLAlchemy — requis par le backend — et se désactive
proprement s'ils manquent.
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


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TestForecastLog(unittest.TestCase):

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

        models_sport.Base.metadata.create_all(bind=database.engine)
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

        seed = self.client.post("/sport/seed-demo?matches_per_team=20")
        self.assertEqual(seed.status_code, 200, seed.text)
        self.seed = seed.json()

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def snapshot(self, **payload):
        body = {"markets": ["1X2"], "signal": "goals", **payload}
        response = self.client.post("/sport/forecasts/snapshot", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_snapshot_freezes_upcoming_matches(self):
        result = self.snapshot()
        self.assertGreater(result["created"], 0)
        self.assertEqual(result["matches_covered"], len(self.seed["upcoming_matches"]))
        rows = self.client.get("/sport/forecasts").json()
        self.assertEqual(len(rows), result["created"])
        for row in rows:
            self.assertIsNone(row["outcome"])
            self.assertIsNotNone(row["model_probability"])
            self.assertIsNotNone(row["frozen_at"])

    def test_a_frozen_forecast_is_never_rewritten(self):
        first = self.snapshot(signal="goals")
        second = self.snapshot(signal="shots")
        self.assertGreater(first["created"], 0)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["skipped"]["already_frozen"], first["created"])
        # La campagne d'origine survit au changement d'avis du modèle.
        rows = self.client.get("/sport/forecasts").json()
        self.assertTrue(all(row["signal"] == "goals" for row in rows))

    def test_a_started_match_cannot_be_forecast(self):
        self.snapshot()
        for match_id in self.seed["upcoming_matches"]:
            self.client.put(f"/sport/matches/{match_id}/result",
                            json={"home_goals": 1, "away_goals": 0})
        # Tous les matchs sont joués : plus rien à geler.
        again = self.snapshot(markets=["OU_2.5"])
        self.assertEqual(again["created"], 0)

    def test_results_resolve_forecasts_faithfully(self):
        self.snapshot(markets=["1X2", "OU_2.5"])
        match_id = self.seed["upcoming_matches"][0]
        response = self.client.put(f"/sport/matches/{match_id}/result",
                                   json={"home_goals": 3, "away_goals": 1})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertGreater(response.json()["resolved_forecasts"], 0)

        rows = [
            row for row in self.client.get("/sport/forecasts").json()
            if row["match_id"] == match_id
        ]
        outcomes = {(row["market"], row["selection"]): row["outcome"] for row in rows}
        # 3-1 : victoire à domicile, plus de 2,5 buts.
        self.assertEqual(outcomes[("1X2", "HOME")], "WON")
        self.assertEqual(outcomes[("1X2", "DRAW")], "LOST")
        self.assertEqual(outcomes[("1X2", "AWAY")], "LOST")
        self.assertEqual(outcomes[("OU_2.5", "OVER")], "WON")
        self.assertEqual(outcomes[("OU_2.5", "UNDER")], "LOST")

    def test_scoreboard_before_and_after_results(self):
        self.snapshot(markets=["1X2", "OU_2.5"])
        before = self.client.get("/sport/forecasts/scoreboard").json()
        self.assertEqual(before["resolved"], 0)
        self.assertEqual(before["pending"], before["frozen_total"])
        self.assertEqual(before["report"]["verdict"], "AUCUNE DONNÉE")
        self.assertTrue(before["next_kickoffs"])

        for index, match_id in enumerate(self.seed["upcoming_matches"]):
            self.client.put(f"/sport/matches/{match_id}/result",
                            json={"home_goals": index % 3, "away_goals": 1})

        after = self.client.get("/sport/forecasts/scoreboard").json()
        self.assertEqual(after["pending"], 0)
        self.assertEqual(after["resolved"], after["frozen_total"])
        self.assertGreater(after["scored_matches"], 0)
        self.assertIsNotNone(after["report"]["brier_model"])
        self.assertIsNotNone(after["report"]["brier_market"])
        # Trop peu de matchs pour conclure : l'outil doit le dire.
        self.assertEqual(after["report"]["verdict"], "ÉCHANTILLON INSUFFISANT")
        self.assertEqual(after["report"]["recommended_market_weight"], 1.0)

    def test_scoreboard_filters(self):
        self.snapshot(markets=["1X2", "OU_2.5"])
        only = self.client.get("/sport/forecasts/scoreboard?market=1X2").json()
        every = self.client.get("/sport/forecasts/scoreboard").json()
        self.assertLess(only["frozen_total"], every["frozen_total"])
        pending = self.client.get("/sport/forecasts?pending_only=true").json()
        self.assertEqual(len(pending), every["frozen_total"])

    def test_unknown_signal_is_rejected(self):
        response = self.client.post("/sport/forecasts/snapshot",
                                    json={"signal": "intuition"})
        self.assertEqual(response.status_code, 400)

    def test_deletion_warns_about_self_deception(self):
        self.snapshot()
        row = self.client.get("/sport/forecasts?limit=1").json()[0]
        response = self.client.delete(f"/sport/forecasts/{row['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertIn("fausse le bilan", response.json()["warning"])
        self.assertEqual(self.client.delete(f"/sport/forecasts/{row['id']}").status_code, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
