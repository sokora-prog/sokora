"""
Régression sur la ligne de commande du script de saisons.

Un défaut y a vécu sans être vu : les positionnels étaient « league » puis
« seasons », si bien qu'avec `--leagues`, argparse rangeait la première saison
dans « league » — qui était ensuite ignorée parce que l'option l'emportait. La
commande `--leagues F1 2627` téléchargeait donc la saison 2024/2025, sans un
mot. Demander une saison et en recevoir une autre est la pire sorte d'erreur
pour cet outil : les chiffres qui suivent sont justes, mais ils ne parlent pas
du bon championnat ni de la bonne année.

L'exemple documenté dans le script lui-même en souffrait — il ne se voyait pas,
parce que la valeur avalée valait justement le défaut.
"""

import importlib.util
import sys
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "fetch_football_data", RACINE / "scripts" / "fetch_football_data.py"
)
fd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fd)


class TestRépartitionDesCodes(unittest.TestCase):

    def test_the_option_form_keeps_its_season(self):
        """Le cas exact qui a échoué : `--leagues F1 2627`."""
        leagues, seasons, inconnus = fd.split_codes(["2627"], "F1")
        self.assertEqual(leagues, ["F1"])
        self.assertEqual(seasons, ["2627"], "la saison demandée a été perdue")
        self.assertEqual(inconnus, [])

    def test_no_season_is_swallowed_when_several_are_given(self):
        leagues, seasons, _ = fd.split_codes(["2526", "2627"], "F1")
        self.assertEqual(seasons, ["2526", "2627"])
        self.assertEqual(leagues, ["F1"])

    def test_the_documented_example_works(self):
        """`--leagues E0,F1,SP1,D1,I1 2425` — l'exemple du fichier lui-même."""
        leagues, seasons, _ = fd.split_codes(["2425"], "E0,F1,SP1,D1,I1")
        self.assertEqual(leagues, ["E0", "F1", "SP1", "D1", "I1"])
        self.assertEqual(seasons, ["2425"])

    def test_the_positional_form_still_works(self):
        leagues, seasons, _ = fd.split_codes(["E0", "2223", "2324", "2425"], None)
        self.assertEqual(leagues, ["E0"])
        self.assertEqual(seasons, ["2223", "2324", "2425"])

    def test_order_does_not_matter(self):
        """Un code de saison est fait de chiffres, un championnat porte une lettre."""
        self.assertEqual(fd.split_codes(["2627", "F1"], None)[:2],
                         fd.split_codes(["F1", "2627"], None)[:2])

    def test_an_unreadable_code_is_reported_never_guessed(self):
        """« 26-27 » n'est ni une saison ni un championnat : deviner serait pire."""
        leagues, seasons, inconnus = fd.split_codes(["F1", "26-27"], None)
        self.assertEqual(inconnus, ["26-27"])
        self.assertEqual(seasons, ["2425"], "le défaut ne doit pas masquer l'erreur")

    def test_duplicates_collapse(self):
        leagues, seasons, _ = fd.split_codes(["E0", "e0", "2425", "2425"], "E0")
        self.assertEqual(leagues, ["E0"])
        self.assertEqual(seasons, ["2425"])

    def test_defaults_apply_only_to_an_empty_command(self):
        leagues, seasons, _ = fd.split_codes([], None)
        self.assertEqual((leagues, seasons), (["E0"], ["2425"]))


class TestDiagnosticDuPort(unittest.TestCase):

    def test_an_unreachable_api_suggests_where_to_look(self):
        """Le port par défaut n'est pas celui de la pile Docker (8001)."""
        message = fd.diagnose_api("http://localhost:9")
        self.assertIn("ne répond pas", message)
        # Sans port ouvert, le message doit dire comment démarrer la pile
        # plutôt que de laisser l'utilisateur deviner.
        self.assertTrue(
            "docker compose" in message or "répond en revanche" in message,
            message,
        )


if __name__ == "__main__":
    unittest.main()
