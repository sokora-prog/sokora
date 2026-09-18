"""
Régression sur le jeton partagé facultatif (SPORT_API_TOKEN).

Le module n'a pas de comptes utilisateur. Tant qu'il n'écoute que la machine
locale, c'est sans conséquence ; dès qu'on l'expose au réseau pour qu'un
téléphone l'atteigne, n'importe qui sur le même Wi-Fi peut lire la bankroll et
modifier les paris. Le jeton ferme cette porte.

Deux propriétés comptent, et sont vérifiées ici :

1. **Sans jeton configuré, rien ne change.** Une installation purement locale ne
   doit pas se voir imposer une authentification qu'elle n'a pas demandée : la
   moindre friction ici pousserait à désactiver le mécanisme au mauvais moment.
2. **Avec un jeton configuré, l'absence ou l'erreur ferme l'accès** — en lecture
   comme en écriture. Un verrou qui ne protège que les écritures laisserait
   lire la bankroll à tout le réseau.

Dépend de FastAPI et SQLAlchemy ; se désactive proprement s'ils manquent.
"""

import importlib
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

TOKEN = "jeton-de-test-42"


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "FastAPI/SQLAlchemy absents")
class TokenTestCase(unittest.TestCase):
    """Monte une application neuve, le jeton valant `token_value`."""

    token_value = ""

    def setUp(self):
        self.db_path = tempfile.mktemp(suffix=".db")
        url = f"sqlite:///{self.db_path}"
        os.environ["DATABASE_URL"] = url
        os.environ["SPORT_API_TOKEN"] = self.token_value

        from app import database
        database.engine = create_engine(url, connect_args={"check_same_thread": False})
        database.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=database.engine
        )
        from app import models_sport, router_sport

        # Le jeton est lu au chargement du module : sans rechargement, le test
        # mesurerait la valeur laissée par le test précédent.
        importlib.reload(router_sport)

        models_sport.Base.metadata.create_all(bind=database.engine)
        app = FastAPI()
        app.include_router(router_sport.router)
        self.client = TestClient(app)

    def tearDown(self):
        os.environ.pop("SPORT_API_TOKEN", None)
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)


class TestWithoutToken(TokenTestCase):
    """Aucun jeton configuré : l'usage local reste sans friction."""

    token_value = ""

    def test_reading_is_open(self):
        self.assertEqual(self.client.get("/sport/competitions").status_code, 200)

    def test_writing_is_open(self):
        response = self.client.post(
            "/sport/competitions", json={"name": "Test", "sport": "football"}
        )
        self.assertEqual(response.status_code, 201, response.text)

    def test_a_token_sent_anyway_is_ignored(self):
        # Une application déjà configurée avec un jeton ne doit pas se retrouver
        # bloquée parce que le serveur, lui, n'en exige aucun.
        response = self.client.get(
            "/sport/competitions", headers={"X-Sport-Token": "peu importe"}
        )
        self.assertEqual(response.status_code, 200)


class TestWithToken(TokenTestCase):
    """Jeton configuré : tout passe par lui."""

    token_value = TOKEN

    def test_reading_without_token_is_refused(self):
        response = self.client.get("/sport/competitions")
        self.assertEqual(response.status_code, 401)
        self.assertIn("jeton", response.json()["detail"].lower())

    def test_writing_without_token_is_refused(self):
        response = self.client.post(
            "/sport/competitions", json={"name": "Test", "sport": "football"}
        )
        self.assertEqual(response.status_code, 401)

    def test_wrong_token_is_refused(self):
        response = self.client.get(
            "/sport/competitions", headers={"X-Sport-Token": "mauvais"}
        )
        self.assertEqual(response.status_code, 401)

    def test_token_prefix_is_refused(self):
        # Un préfixe correct ne doit pas mieux réussir qu'une valeur quelconque :
        # c'est la propriété qu'assure la comparaison à temps constant.
        response = self.client.get(
            "/sport/competitions", headers={"X-Sport-Token": TOKEN[:-1]}
        )
        self.assertEqual(response.status_code, 401)

    def test_right_token_passes(self):
        response = self.client.get(
            "/sport/competitions", headers={"X-Sport-Token": TOKEN}
        )
        self.assertEqual(response.status_code, 200)

    def test_write_with_right_token_passes(self):
        response = self.client.post(
            "/sport/competitions",
            json={"name": "Test", "sport": "football"},
            headers={"X-Sport-Token": TOKEN},
        )
        self.assertEqual(response.status_code, 201, response.text)


if __name__ == "__main__":
    unittest.main()
