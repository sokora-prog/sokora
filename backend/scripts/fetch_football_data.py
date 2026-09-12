#!/usr/bin/env python3
"""
SOKORA SPORT — Récupération de saisons réelles depuis football-data.co.uk

Ces fichiers sont, pour le football européen, la source gratuite la plus utile :
scores, statistiques de match, et surtout **les cotes de clôture** de plusieurs
bookmakers — sans lesquelles la calibration du modèle n'a aucune barre à
franchir.

Usage :

    # Une saison
    python3 backend/scripts/fetch_football_data.py E0 2425

    # Plusieurs saisons d'un même championnat (le modèle a besoin de volume)
    python3 backend/scripts/fetch_football_data.py E0 2223 2324 2425

    # Plusieurs championnats
    python3 backend/scripts/fetch_football_data.py --leagues E0,F1,SP1,D1,I1 2425

    # Sans importer, pour inspecter les fichiers d'abord
    python3 backend/scripts/fetch_football_data.py E0 2425 --out ./data --no-import

Codes de championnat les plus courants :

    E0  Premier League       E1  Championship      SC0 Écosse Premiership
    F1  Ligue 1              F2  Ligue 2           D1  Bundesliga
    SP1 Liga                 I1  Serie A           N1  Eredivisie
    P1  Portugal Primeira    B1  Belgique Pro      T1  Turquie Süper Lig

Le code de saison joint les deux millésimes : 2425 = saison 2024/2025.

Le script n'écrit rien de lui-même en base : il envoie le CSV tel quel à
POST /sport/matches/import, qui sait déjà lire ce format (équipes, scores,
statistiques et colonnes de cotes, ouverture comme clôture).
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://www.football-data.co.uk/mmz4281"
DEFAULT_API = "http://localhost:8000"

LEAGUE_NAMES = {
    "E0": "Premier League", "E1": "Championship", "E2": "League One",
    "EC": "Conference", "SC0": "Scottish Premiership",
    "F1": "Ligue 1", "F2": "Ligue 2",
    "D1": "Bundesliga", "D2": "2. Bundesliga",
    "SP1": "La Liga", "SP2": "La Liga 2",
    "I1": "Serie A", "I2": "Serie B",
    "N1": "Eredivisie", "B1": "Jupiler Pro League",
    "P1": "Primeira Liga", "T1": "Süper Lig", "G1": "Super League Grèce",
}


def season_label(code: str) -> str:
    """« 2425 » → « 2024/2025 »."""
    if len(code) != 4 or not code.isdigit():
        return code
    start, end = code[:2], code[2:]
    century = "20" if int(start) < 90 else "19"
    return f"{century}{start}/{century}{end}"


def download(league: str, season: str, timeout: int = 60) -> str:
    url = f"{BASE_URL}/{season}/{league}.csv"
    request = urllib.request.Request(
        url, headers={"User-Agent": "sokora-sport/1.0 (analyse personnelle)"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    # Ces fichiers sont encodés en Latin-1 et contiennent parfois des lignes
    # vides en fin de fichier.
    return raw.decode("latin-1", errors="replace").strip()


def post_import(api: str, payload: dict, timeout: int = 300) -> dict:
    request = urllib.request.Request(
        f"{api.rstrip('/')}/sport/matches/import",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Télécharge des saisons football-data.co.uk et les importe.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("league", nargs="?", default="E0",
                        help="Code du championnat (défaut : E0)")
    parser.add_argument("seasons", nargs="*", default=["2425"],
                        help="Codes de saison, ex. 2324 2425")
    parser.add_argument("--leagues", help="Plusieurs championnats séparés par des virgules")
    parser.add_argument("--api", default=DEFAULT_API, help=f"URL de l'API (défaut : {DEFAULT_API})")
    parser.add_argument("--out", help="Répertoire où conserver les CSV téléchargés")
    parser.add_argument("--no-import", action="store_true",
                        help="Télécharger seulement, sans envoyer à l'API")
    parser.add_argument("--closing-only", action="store_true",
                        help="N'importer que les cotes de clôture")
    parser.add_argument("--bookmakers", default="Pinnacle,Moyenne,Meilleure",
                        help="Bookmakers à importer, séparés par des virgules")
    args = parser.parse_args()

    leagues = (
        [code.strip().upper() for code in args.leagues.split(",") if code.strip()]
        if args.leagues else [args.league.upper()]
    )
    seasons = args.seasons or ["2425"]
    out_dir = Path(args.out) if args.out else None
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    total_matches = total_odds = total_closing = 0
    failures = []

    for league in leagues:
        name = LEAGUE_NAMES.get(league, league)
        for season in seasons:
            label = f"{name} {season_label(season)}"
            print(f"→ {label} ({league}/{season})…", flush=True)
            try:
                csv_text = download(league, season)
            except urllib.error.HTTPError as error:
                print(f"   échec du téléchargement : HTTP {error.code}")
                failures.append(f"{league}/{season} (HTTP {error.code})")
                continue
            except Exception as error:  # réseau coupé, DNS, proxy…
                print(f"   échec du téléchargement : {error}")
                failures.append(f"{league}/{season} ({error})")
                continue

            lines = csv_text.count("\n")
            print(f"   {lines} lignes téléchargées")
            if out_dir:
                path = out_dir / f"{league}_{season}.csv"
                path.write_text(csv_text, encoding="utf-8")
                print(f"   enregistré dans {path}")

            if args.no_import:
                continue

            payload = {
                "competition_name": name,
                "season": season_label(season),
                "csv_text": csv_text,
                "import_odds": True,
                "closing_odds_only": args.closing_only,
                "odds_bookmakers": [
                    book.strip() for book in args.bookmakers.split(",") if book.strip()
                ],
            }
            try:
                result = post_import(args.api, payload)
            except urllib.error.HTTPError as error:
                detail = error.read().decode("utf-8", errors="replace")[:300]
                print(f"   échec de l'import : HTTP {error.code} — {detail}")
                failures.append(f"import {league}/{season}")
                continue
            except Exception as error:
                print(f"   échec de l'import : {error}")
                print(f"   (l'API répond-elle sur {args.api} ?)")
                failures.append(f"import {league}/{season}")
                continue

            total_matches += result["created"]
            total_odds += result.get("odds_created", 0)
            total_closing += result.get("closing_odds_created", 0)
            print(
                f"   {result['created']} matchs importés, "
                f"{result['skipped']} ignorés · "
                f"{result.get('odds_created', 0)} cotes "
                f"(dont {result.get('closing_odds_created', 0)} de clôture)"
            )

    print()
    print(f"Total : {total_matches} matchs, {total_odds} cotes, "
          f"{total_closing} de clôture.")
    if failures:
        print("Échecs :", ", ".join(failures))
    if total_closing and not args.no_import:
        print()
        print("Étape suivante — confronter le modèle au marché :")
        print(f"  curl -s '{args.api}/sport/calibration?market=1X2' | python3 -m json.tool")
        print("  ou l'onglet « Réalisme » du tableau de bord.")
    return 1 if failures and not total_matches else 0


if __name__ == "__main__":
    sys.exit(main())
