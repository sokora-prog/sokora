"""
Régression sur le défaut prudent du balayage de valeur.

L'outil repose sur une promesse : ne proposer une mise que là où le modèle a
démontré qu'il bat la cote de clôture. Cette promesse ne tient qu'à la valeur
par défaut de `only_proven` — et une valeur par défaut, contrairement à une
fonctionnalité, ne se voit pas : rien ne signale qu'elle a changé.

Elle avait d'ailleurs dérivé. Le tableau de bord affichait le verdict « aucun
avantage démontré, suivre le marché » et listait, sur le même écran, deux
sélections avec mise de Kelly et fiabilité « élevée ». L'onglet Valeur, lui,
filtrait correctement, parce que l'interface passait le paramètre explicitement.
Le désaccord ne venait donc pas du filtre mais de qui pensait à le demander.

D'où ces tests, qui vérifient l'invariant plutôt que les nombres : le tableau de
bord ne doit jamais proposer une sélection que l'onglet Valeur écarterait.
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


def identity(bet):
    """De quoi comparer deux sélections sans dépendre du formatage."""
    return (bet["match_id"], bet["market"], bet["selection"])


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TestSafeDefaults(unittest.TestCase):

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

        seed = self.client.post("/sport/seed-demo?matches_per_team=26")
        self.assertEqual(seed.status_code, 200, seed.text)

    def tearDown(self):
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def test_value_bets_filters_by_default(self):
        """Sans paramètre, le balayage ne retient que les poches démontrées."""
        data = self.client.get("/sport/value-bets").json()
        self.assertTrue(
            data["only_proven"],
            "Le défaut de /sport/value-bets doit être le filtre actif : sans "
            "cela, l'outil propose des mises que rien n'étaye.",
        )

    def test_dashboard_never_contradicts_the_value_tab(self):
        """Le tableau de bord ne propose rien que l'onglet Valeur écarterait."""
        dashboard = self.client.get("/sport/dashboard").json()
        proven = self.client.get("/sport/value-bets?only_proven=true&limit=200").json()

        allowed = {identity(b) for b in proven["opportunities"]}
        shown = [identity(b) for b in dashboard["top_value_bets"]]

        for bet in shown:
            self.assertIn(
                bet, allowed,
                "Le tableau de bord met en avant une sélection que le filtre "
                "des poches démontrées rejette — c'est la contradiction que "
                "l'outil est censé éviter.",
            )

    def test_dashboard_says_why_the_list_is_empty(self):
        """Une liste vide sans explication se lit comme une panne."""
        dashboard = self.client.get("/sport/dashboard").json()
        self.assertIn("top_value_note", dashboard)
        if not dashboard["top_value_bets"]:
            self.assertTrue(dashboard["top_value_note"].strip())
            # La raison doit distinguer « pas de cotes » de « rien de démontré ».
            self.assertGreater(dashboard["top_value_scanned"], 0)
            self.assertIn("démontré", dashboard["top_value_note"].lower())

    def test_disabling_the_filter_can_only_widen_the_list(self):
        """Le filtre retire des sélections ; il n'en invente jamais."""
        strict = self.client.get("/sport/value-bets?only_proven=true&limit=200").json()
        loose = self.client.get("/sport/value-bets?only_proven=false&limit=200").json()

        self.assertFalse(loose["only_proven"])
        self.assertGreaterEqual(loose["count"], strict["count"])
        self.assertTrue(
            {identity(b) for b in strict["opportunities"]}
            <= {identity(b) for b in loose["opportunities"]}
        )

    def test_unfiltered_scan_warns_explicitly(self):
        """Désactiver le filtre doit se voir dans la réponse, pas seulement dans
        l'esprit de qui a passé le paramètre."""
        loose = self.client.get("/sport/value-bets?only_proven=false").json()
        self.assertIn("n'est pas établi", loose["filter_note"])


if __name__ == "__main__":
    unittest.main()
