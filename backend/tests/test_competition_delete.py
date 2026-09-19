"""
Régression sur la suppression d'une compétition.

Supprimer une compétition doit emporter tout ce qui en dépend. Le risque n'est
pas l'échec visible — il est silencieux : des cotes, des paris ou des prévisions
qui survivent à leur match et faussent ensuite les mesures. La calibration
compte des prévisions ; le suivi compte des paris. Des lignes orphelines ne
disparaissent d'aucun écran, mais elles comptent quand même.

Les cascades sont déclarées sur `Competition.teams` et `Competition.matches`,
pas sur les enfants du match. Rien dans le code ne garantit donc que les cotes
et les prévisions suivent : c'est exactement ce que ce test fixe.
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
class TestCompetitionDelete(unittest.TestCase):

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

        seed = self.client.post("/sport/seed-demo?matches_per_team=10")
        self.assertEqual(seed.status_code, 200, seed.text)
        self.competition_id = self.client.get("/sport/competitions").json()[0]["id"]

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def count(self, model):
        session = self.database.SessionLocal()
        try:
            return session.query(model).count()
        finally:
            session.close()

    def test_delete_removes_every_dependent_row(self):
        # On fabrique aussi des prévisions gelées : ce sont elles qui, restées
        # orphelines, fausseraient ensuite le verdict de calibration.
        snapshot = self.client.post(
            "/sport/forecasts/snapshot", json={"markets": ["1X2"], "signal": "goals"}
        )
        self.assertEqual(snapshot.status_code, 201, snapshot.text)

        before = {
            "équipes": self.count(self.models.SportTeam),
            "matchs": self.count(self.models.SportMatch),
            "cotes": self.count(self.models.OddsQuote),
            "prévisions": self.count(self.models.SportForecast),
        }
        for nom, valeur in before.items():
            self.assertGreater(valeur, 0, f"le jeu de démonstration devrait créer des {nom}")

        response = self.client.delete(f"/sport/competitions/{self.competition_id}")
        self.assertEqual(response.status_code, 200, response.text)

        for nom, model in (
            ("équipes", self.models.SportTeam),
            ("matchs", self.models.SportMatch),
            ("cotes", self.models.OddsQuote),
            ("prévisions", self.models.SportForecast),
        ):
            self.assertEqual(
                self.count(model), 0,
                f"des {nom} survivent à la suppression de leur compétition",
            )

    def test_bets_are_detached_not_erased(self):
        """
        Un pari n'est pas une donnée dérivée : la mise a réellement été engagée,
        et le ROI comme la bankroll en dépendent. Supprimer une compétition ne
        doit donc pas retoucher l'historique financier — le pari est détaché de
        son match, pas effacé.
        """
        match_id = self.client.get("/sport/matches?status=SCHEDULED").json()[0]["id"]
        bet = self.client.post("/sport/bets", json={
            "match_id": match_id, "market": "1X2", "selection": "1",
            "odds": 2.10, "stake": 25.0, "label": "test",
        })
        self.assertEqual(bet.status_code, 201, bet.text)

        self.client.delete(f"/sport/competitions/{self.competition_id}")

        session = self.database.SessionLocal()
        try:
            paris = session.query(self.models.SportBet).all()
            self.assertEqual(len(paris), 1, "le pari a été effacé avec la compétition")
            self.assertIsNone(paris[0].match_id, "le pari pointe encore un match supprimé")
            self.assertEqual(paris[0].stake, 25.0)
        finally:
            session.close()

    def test_dashboard_still_answers_after_delete(self):
        """Une base vidée doit rester utilisable, pas renvoyer une erreur."""
        self.client.delete(f"/sport/competitions/{self.competition_id}")
        self.assertEqual(self.client.get("/sport/competitions").json(), [])
        response = self.client.get("/sport/dashboard")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["top_value_bets"], [])


if __name__ == "__main__":
    unittest.main()
