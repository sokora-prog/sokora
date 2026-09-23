#!/usr/bin/env python3
"""
SOKORA SPORT — Récupération depuis API-Football (api-sports.io)

Pourquoi cette source. Le banc d'essai du laboratoire compare quatre façons de
mesurer une équipe, et l'une d'elles — les buts attendus (xG) — affiche
**0 % de couverture** : football-data.co.uk n'en publie pas. La variante retombe
donc silencieusement sur les buts et ne mesure rien. API-Football est le seul
agrégateur au palier gratuit qui porte à la fois des cotes et des statistiques
de match, xG comprise.

Trois mises en garde, écrites dans le code plutôt que dans une note :

1. **La couverture xG d'API-Football est irrégulière** selon la ligue et la
   saison. Ce script la *mesure* et l'affiche par champ. Ne payez jamais pour
   du xG sans avoir vu ce chiffre sur vos ligues.
2. **Le palier gratuit plafonne à une centaine de requêtes par jour**, et les
   statistiques comme les cotes se demandent **un match à la fois**. Une saison
   de 380 rencontres coûte donc plusieurs jours de quota. D'où le cache sur
   disque (une réponse déjà connue ne coûte rien) et le budget de requêtes :
   le travail s'interrompt proprement et reprend le lendemain.
3. **API-Football répond HTTP 200 même quand votre offre n'autorise pas
   l'appel** : le corps porte alors un objet `errors`. Un client naïf lit
   `response: []` et conclut « pas de données » là où la vérité est « pas
   votre offre ». Ce script distingue les deux et le dit.

Usage :

    # La clé ne vit jamais dans le dépôt
    export API_FOOTBALL_KEY=...            # PowerShell : $env:API_FOOTBALL_KEY="..."

    # Vérifier la clé, l'offre et le quota restant — 1 requête
    python3 backend/scripts/fetch_api_football.py --status

    # Retrouver l'identifiant d'une ligue — 1 requête
    python3 backend/scripts/fetch_api_football.py --find-league "Premier League"

    # Les matchs joués d'une saison (scores + cotes de la ligue) — quelques requêtes
    python3 backend/scripts/fetch_api_football.py --league 39 --season 2025

    # Y ajouter les statistiques (xG, tirs cadrés) des 60 derniers matchs
    python3 backend/scripts/fetch_api_football.py --league 39 --season 2025 --stats 60

    # Les affiches à venir, avec leurs cotes, pour le journal de prévisions
    python3 backend/scripts/fetch_api_football.py --league 39 --season 2025 --upcoming

Le script n'écrit rien en base lui-même : il normalise au format
football-data.co.uk et le confie à `POST /sport/matches/import`, qui sait déjà
dédoublonner, compléter une affiche par son résultat et noter les prévisions
gelées au passage.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_API = "http://localhost:8000"
DIRECT_HOST = "v3.football.api-sports.io"
RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"
CACHE_DIR = Path(os.environ.get("API_FOOTBALL_CACHE",
                                Path.home() / ".sokora_sport" / "api_football"))

#: Raccourcis usuels. Ce ne sont **pas** des identifiants garantis : API-Football
#: peut les faire évoluer. `--find-league` interroge la source et tranche.
LEAGUE_HINTS = {
    39: "Premier League", 40: "Championship", 61: "Ligue 1", 62: "Ligue 2",
    78: "Bundesliga", 79: "2. Bundesliga", 135: "Serie A", 136: "Serie B",
    140: "La Liga", 141: "La Liga 2", 88: "Eredivisie", 94: "Primeira Liga",
    144: "Jupiler Pro League", 203: "Süper Lig", 179: "Scottish Premiership",
}

#: Bookmakers d'API-Football → noms attendus par l'application. La ligne de
#: Pinnacle sert d'avis du marché, la meilleure cote sert de mise : mélanger
#: les deux n'aurait pas de sens, donc chacun garde son identité.
BOOKMAKER_ALIASES = {
    "pinnacle": "Pinnacle", "pinnacle sports": "Pinnacle",
    "bet365": "Bet365", "bwin": "Bwin", "william hill": "William Hill",
    "1xbet": "1xBet", "betfair": "Betfair", "marathonbet": "Marathonbet",
    "unibet": "Unibet", "betano": "Betano", "betwin": "Bwin",
}

#: Colonnes du format football-data.co.uk que l'import reconnaît déjà.
CSV_COLUMNS = [
    "Div", "Date", "Time", "HomeTeam", "AwayTeam",
    "FTHG", "FTAG", "FTR", "HTHG", "HTAG",
    "HS", "AS", "HST", "AST", "HC", "AC", "HXG", "AXG",
    # 1X2 et plus/moins 2,5 buts, à l'ouverture puis à la clôture
    "PSH", "PSD", "PSA", "PSCH", "PSCD", "PSCA",
    "MaxH", "MaxD", "MaxA", "MaxCH", "MaxCD", "MaxCA",
    "AvgH", "AvgD", "AvgA", "AvgCH", "AvgCD", "AvgCA",
    "B365H", "B365D", "B365A", "B365CH", "B365CD", "B365CA",
    "P>2.5", "P<2.5", "PC>2.5", "PC<2.5",
    "Max>2.5", "Max<2.5", "MaxC>2.5", "MaxC<2.5",
    "Avg>2.5", "Avg<2.5", "AvgC>2.5", "AvgC<2.5",
]

#: Libellés de statistiques d'API-Football → colonnes CSV (domicile, extérieur).
STAT_FIELDS = {
    "shots on goal": ("HST", "AST"),
    "total shots": ("HS", "AS"),
    "corner kicks": ("HC", "AC"),
    "expected_goals": ("HXG", "AXG"),
    "expected goals": ("HXG", "AXG"),
}


class PlanError(RuntimeError):
    """L'offre souscrite n'autorise pas cet appel (HTTP 200 + `errors`)."""


class QuotaError(RuntimeError):
    """Le quota du jour est épuisé."""


class BudgetExhausted(RuntimeError):
    """Le budget de requêtes fixé pour cette exécution est atteint."""


# ═══════════════════════════════════════════════════════════════════════════
#  CLIENT
# ═══════════════════════════════════════════════════════════════════════════

class ApiFootball:
    """Client économe : cache sur disque, budget de requêtes, erreurs nommées."""

    def __init__(self, key: str, rapidapi: bool = False, budget: int = 90,
                 cache_dir: Path = CACHE_DIR, verbose: bool = True):
        self.key = key
        self.host = RAPIDAPI_HOST if rapidapi else DIRECT_HOST
        self.rapidapi = rapidapi
        self.budget = budget
        self.cache_dir = cache_dir
        self.verbose = verbose
        self.spent = 0          # requêtes réellement envoyées
        self.served = 0         # réponses servies par le cache
        self.remaining: Optional[str] = None

    # ── cache ───────────────────────────────────────────────────────────────

    def _cache_path(self, path: str, params: dict) -> Path:
        clé = json.dumps([path, sorted(params.items())], sort_keys=True)
        digest = hashlib.sha256(clé.encode("utf-8")).hexdigest()[:24]
        return self.cache_dir / path.strip("/").replace("/", "_") / f"{digest}.json"

    # ── appel ───────────────────────────────────────────────────────────────

    def get(self, path: str, params: dict, cacheable: bool = True) -> dict:
        """Une page de résultats, du cache si possible.

        Le cache n'est pas une optimisation : sans lui, une saison de statistiques
        épuiserait le quota de plusieurs journées à chaque relance du script.
        """
        fichier = self._cache_path(path, params)
        if cacheable and fichier.exists():
            self.served += 1
            return json.loads(fichier.read_text(encoding="utf-8"))

        if self.spent >= self.budget:
            raise BudgetExhausted(
                f"budget de {self.budget} requêtes atteint ; relancez la même "
                "commande demain, le cache reprendra où il s'est arrêté"
            )

        url = f"https://{self.host}/{path.lstrip('/')}?{urllib.parse.urlencode(params)}"
        entêtes = (
            {"x-rapidapi-key": self.key, "x-rapidapi-host": self.host}
            if self.rapidapi else {"x-apisports-key": self.key}
        )
        requête = urllib.request.Request(url, headers=entêtes)
        try:
            with urllib.request.urlopen(requête, timeout=60) as réponse:
                self.remaining = réponse.headers.get("x-ratelimit-requests-remaining")
                corps = json.load(réponse)
        except urllib.error.HTTPError as erreur:
            détail = erreur.read().decode("utf-8", errors="replace")[:300]
            if erreur.code == 429:
                raise QuotaError(f"quota épuisé (HTTP 429) — {détail}") from erreur
            raise RuntimeError(f"HTTP {erreur.code} sur {path} — {détail}") from erreur

        self.spent += 1
        # API-Football répond 200 avec un objet `errors` quand l'offre ne couvre
        # pas l'appel, quand la clé est refusée ou quand le quota est atteint.
        # Confondre cela avec « aucune donnée » serait la pire des erreurs ici.
        erreurs = corps.get("errors")
        if isinstance(erreurs, dict) and erreurs:
            texte = " | ".join(f"{k}: {v}" for k, v in erreurs.items())
            if any(mot in texte.lower() for mot in ("plan", "subscription", "allow")):
                raise PlanError(texte)
            if any(mot in texte.lower() for mot in ("quota", "rate", "limit")):
                raise QuotaError(texte)
            raise RuntimeError(texte)
        if isinstance(erreurs, list) and erreurs:
            raise RuntimeError("; ".join(str(e) for e in erreurs))

        if cacheable:
            fichier.parent.mkdir(parents=True, exist_ok=True)
            fichier.write_text(json.dumps(corps), encoding="utf-8")
        time.sleep(0.25)   # courtoisie envers un service gratuit
        return corps

    def get_all(self, path: str, params: dict) -> List[dict]:
        """Toutes les pages d'un endpoint paginé."""
        page, résultats = 1, []
        while True:
            corps = self.get(path, {**params, "page": page})
            résultats.extend(corps.get("response") or [])
            pagination = (corps.get("paging") or {})
            if page >= int(pagination.get("total") or 1):
                return résultats
            page += 1


# ═══════════════════════════════════════════════════════════════════════════
#  NORMALISATION
# ═══════════════════════════════════════════════════════════════════════════

def season_label(season: int) -> str:
    """API-Football compte les saisons par leur année d'ouverture : 2025 → 2025/2026."""
    return f"{season}/{season + 1}"


def fixture_row(fixture: dict, div: str) -> Optional[dict]:
    """Une entrée `/fixtures` → une ligne au format football-data.co.uk.

    Renvoie ``None`` pour un match ni joué ni à venir (reporté, annulé) : mieux
    vaut l'écarter que d'inventer un score ou une affiche qui n'aura pas lieu.
    """
    infos = fixture.get("fixture") or {}
    équipes = fixture.get("teams") or {}
    buts = fixture.get("goals") or {}
    score = fixture.get("score") or {}
    statut = ((infos.get("status") or {}).get("short") or "").upper()

    domicile = ((équipes.get("home") or {}).get("name") or "").strip()
    extérieur = ((équipes.get("away") or {}).get("name") or "").strip()
    if not domicile or not extérieur:
        return None

    horodatage = infos.get("date")
    try:
        coup_envoi = datetime.fromisoformat(str(horodatage).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    coup_envoi = coup_envoi.astimezone(timezone.utc)

    ligne = {colonne: "" for colonne in CSV_COLUMNS}
    # L'identifiant, pas le nom : les noms sont réécrits plus loin pour coller à
    # ceux de la base, et une statistique appariée sur un nom déjà traduit
    # atterrirait du mauvais côté du match.
    ligne["_home_id"] = (équipes.get("home") or {}).get("id")
    ligne.update({
        "Div": div,
        "Date": coup_envoi.strftime("%d/%m/%Y"),
        "Time": coup_envoi.strftime("%H:%M"),
        "HomeTeam": domicile,
        "AwayTeam": extérieur,
    })

    # FT = terminé ; AET/PEN portent un score de prolongation qui ne relève pas
    # du modèle de temps réglementaire : on garde le score à 90 minutes.
    if statut in ("FT", "AET", "PEN"):
        plein_temps = score.get("fulltime") or {}
        bd = plein_temps.get("home", buts.get("home"))
        be = plein_temps.get("away", buts.get("away"))
        if bd is None or be is None:
            return None
        ligne["FTHG"], ligne["FTAG"] = int(bd), int(be)
        ligne["FTR"] = "H" if bd > be else ("A" if be > bd else "D")
        mi_temps = score.get("halftime") or {}
        if mi_temps.get("home") is not None:
            ligne["HTHG"], ligne["HTAG"] = mi_temps["home"], mi_temps["away"]
        return ligne

    if statut in ("NS", "TBD"):
        # Affiche à venir : pas de score, l'import la retiendra comme programmée.
        return ligne

    return None


def apply_statistics(ligne: dict, réponse: List[dict],
                     domicile: Optional[str] = None,
                     home_id: Optional[int] = None) -> List[str]:
    """Verse les statistiques d'un match dans sa ligne. Renvoie les champs remplis.

    L'appariement se fait sur l'**identifiant** d'équipe quand il est connu. Le
    nom ne convient pas : `run()` le réécrit avant cet appel pour coller à la
    base, si bien qu'un appariement par nom enverrait les deux blocs du côté
    extérieur — les tirs et le xG du domicile disparaîtraient en silence.
    """
    if home_id is None:
        home_id = ligne.get("_home_id")
    attendu_domicile = domicile or ligne.get("HomeTeam")
    attendu_extérieur = ligne.get("AwayTeam")

    # Chaque bloc doit être attribué avec certitude. Dans le doute, on n'écrit
    # rien : une statistique rangée du mauvais côté est bien pire qu'une
    # statistique absente — l'absence se voit dans la couverture, l'inversion
    # produit des forces d'équipe fausses que rien ne signale.
    côtés = []
    for bloc in réponse or []:
        équipe = bloc.get("team") or {}
        identifiant = équipe.get("id")
        nom = str(équipe.get("name") or "").strip()
        if home_id is not None and identifiant is not None:
            côtés.append(identifiant == home_id)
        elif nom and nom == attendu_domicile:
            côtés.append(True)
        elif nom and nom == attendu_extérieur:
            côtés.append(False)
        else:
            return []
    if len(côtés) != len(set(côtés)) or (côtés and len(côtés) > 2):
        return []   # deux blocs du même côté : l'appariement est faux

    remplis = []
    for est_domicile, bloc in zip(côtés, réponse or []):
        for statistique in bloc.get("statistics") or []:
            libellé = str(statistique.get("type") or "").strip().lower()
            cible = STAT_FIELDS.get(libellé)
            if not cible:
                continue
            valeur = statistique.get("value")
            if valeur in (None, ""):
                continue
            texte = str(valeur).replace("%", "").strip()
            try:
                nombre = float(texte)
            except ValueError:
                continue
            colonne = cible[0] if est_domicile else cible[1]
            ligne[colonne] = nombre if colonne in ("HXG", "AXG") else int(nombre)
            remplis.append(colonne)
    return remplis


def apply_odds(ligne: dict, réponse: List[dict], closing: bool) -> List[str]:
    """Verse les cotes 1X2 et plus/moins 2,5 buts. Renvoie les books retenus.

    Les cotes d'API-Football n'ont pas d'étiquette « clôture » : c'est l'instant
    de la récupération qui en décide. Le drapeau est donc explicite, et par
    défaut elles sont enregistrées comme cotes d'ouverture — appeler « clôture »
    une cote relevée trois jours plus tôt fausserait toute la calibration.
    """
    suffixe = "C" if closing else ""
    par_book: Dict[str, Dict[str, float]] = {}

    for entrée in réponse or []:
        for book in entrée.get("bookmakers") or []:
            nom = BOOKMAKER_ALIASES.get(
                str(book.get("name") or "").strip().lower()
            )
            if not nom:
                continue
            cotes = par_book.setdefault(nom, {})
            for pari in book.get("bets") or []:
                libellé = str(pari.get("name") or "").strip().lower()
                valeurs = {
                    str(v.get("value") or "").strip().lower(): v.get("odd")
                    for v in pari.get("values") or []
                }

                def nombre(clé):
                    brut = valeurs.get(clé)
                    try:
                        valeur = float(str(brut).replace(",", "."))
                    except (TypeError, ValueError):
                        return None
                    return valeur if valeur > 1.0 else None

                if libellé in ("match winner", "full time result", "1x2"):
                    for clé, cible in (("home", "H"), ("draw", "D"), ("away", "A")):
                        valeur = nombre(clé)
                        if valeur:
                            cotes[cible] = valeur
                elif libellé in ("goals over/under", "over/under"):
                    for clé, cible in (("over 2.5", ">2.5"), ("under 2.5", "<2.5")):
                        valeur = nombre(clé)
                        if valeur:
                            cotes[cible] = valeur

    # Une ligne 1X2 incomplète ne vaut rien : la marge et la dévigorisation
    # exigent les trois issues du même book.
    retenus = []
    for nom, cotes in par_book.items():
        préfixe = {"Pinnacle": "PS", "Bet365": "B365"}.get(nom)
        if préfixe and all(clé in cotes for clé in "HDA"):
            for clé in "HDA":
                colonne = (f"{préfixe}{suffixe}{clé}" if préfixe == "PS"
                           else f"{préfixe}{suffixe}{clé}")
                if colonne in ligne:
                    ligne[colonne] = cotes[clé]
            retenus.append(nom)
        if préfixe and all(clé in cotes for clé in (">2.5", "<2.5")):
            racine = "P" if préfixe == "PS" else "B365"
            for clé in (">2.5", "<2.5"):
                colonne = f"{racine}{suffixe}{clé}"
                if colonne in ligne:
                    ligne[colonne] = cotes[clé]

    # Moyenne et meilleure cote, calculées sur les books qui donnent une ligne
    # complète — c'est ce que font les colonnes Avg / Max de football-data.co.uk.
    complets = [c for c in par_book.values() if all(k in c for k in "HDA")]
    if complets:
        for clé in "HDA":
            série = [c[clé] for c in complets]
            ligne[f"Avg{suffixe}{clé}"] = round(sum(série) / len(série), 3)
            ligne[f"Max{suffixe}{clé}"] = max(série)
        retenus.extend(["Moyenne", "Meilleure"])
    totaux = [c for c in par_book.values() if all(k in c for k in (">2.5", "<2.5"))]
    if totaux:
        for clé in (">2.5", "<2.5"):
            série = [c[clé] for c in totaux]
            ligne[f"Avg{suffixe}{clé}"] = round(sum(série) / len(série), 3)
            ligne[f"Max{suffixe}{clé}"] = max(série)

    return sorted(set(retenus))


def to_csv(lignes: List[dict]) -> str:
    tampon = io.StringIO()
    écrivain = csv.DictWriter(tampon, fieldnames=CSV_COLUMNS)
    écrivain.writeheader()
    écrivain.writerows(lignes)
    return tampon.getvalue()


# ═══════════════════════════════════════════════════════════════════════════
#  NOMS D'ÉQUIPE — LE PIÈGE QUI COUPERAIT L'HISTORIQUE EN DEUX
# ═══════════════════════════════════════════════════════════════════════════

def simplify(nom: str) -> str:
    """Forme comparable d'un nom de club.

    L'application apparie les équipes sur leur nom **exact**. « Manchester City »
    d'API-Football et « Man City » de football-data.co.uk deviendraient donc deux
    équipes distinctes dans la même compétition, chacune avec la moitié de
    l'historique — sans qu'aucun écran ne le signale. C'est la pire sorte de
    dégât : invisible, et il fausse toutes les forces d'équipe.
    """
    import unicodedata
    texte = unicodedata.normalize("NFKD", nom.lower())
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    for bruit in (" football club", " futbol club", " fussball club",
                  " fc ", " cf ", " afc ", " ac ", " sc ", " cd ", " ud ",
                  " calcio", " 1. ", " 04", " 05", " 96", " 1899", " 1846"):
        texte = texte.replace(bruit, " ")
    for préfixe, suffixe in (("fc ", ""), ("cf ", ""), ("ac ", ""), ("as ", ""),
                             ("sv ", ""), ("vfl ", ""), ("vfb ", ""), ("tsg ", ""),
                             ("rc ", ""), ("sd ", ""), ("ca ", "")):
        if texte.startswith(préfixe):
            texte = texte[len(préfixe):]
    for fin in (" fc", " cf", " afc", " ac", " sc", " sv", " bc", " ii"):
        if texte.endswith(fin):
            texte = texte[: -len(fin)]
    return " ".join(texte.split())


def build_team_mapping(noms_source: List[str], noms_base: List[str],
                       aliases: Dict[str, str]) -> Tuple[Dict[str, str], List[str], Dict[str, str]]:
    """Apparie les noms d'API-Football à ceux déjà en base.

    Renvoie (correspondances sûres, noms non appariés, propositions à relire).
    Une ressemblance n'est jamais appliquée d'office : elle est proposée.
    """
    import difflib

    par_forme = {}
    for nom in noms_base:
        par_forme.setdefault(simplify(nom), nom)

    sûres: Dict[str, str] = {}
    propositions: Dict[str, str] = {}
    orphelins: List[str] = []

    for nom in noms_source:
        if nom in aliases:
            sûres[nom] = aliases[nom]
            continue
        if nom in noms_base:
            sûres[nom] = nom
            continue
        forme = simplify(nom)
        if forme in par_forme:
            sûres[nom] = par_forme[forme]
            continue
        proches = difflib.get_close_matches(forme, list(par_forme), n=1, cutoff=0.72)
        if proches:
            propositions[nom] = par_forme[proches[0]]
        else:
            orphelins.append(nom)

    return sûres, orphelins, propositions


# ═══════════════════════════════════════════════════════════════════════════
#  DIALOGUE AVEC L'APPLICATION
# ═══════════════════════════════════════════════════════════════════════════

def app_get(api: str, chemin: str, timeout: int = 60):
    requête = urllib.request.Request(f"{api.rstrip('/')}{chemin}")
    jeton = os.environ.get("SPORT_API_TOKEN")
    if jeton:
        requête.add_header("X-Sport-Token", jeton)
    with urllib.request.urlopen(requête, timeout=timeout) as réponse:
        return json.load(réponse)


def app_post(api: str, chemin: str, charge: dict, timeout: int = 300):
    requête = urllib.request.Request(
        f"{api.rstrip('/')}{chemin}",
        data=json.dumps(charge).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    jeton = os.environ.get("SPORT_API_TOKEN")
    if jeton:
        requête.add_header("X-Sport-Token", jeton)
    with urllib.request.urlopen(requête, timeout=timeout) as réponse:
        return json.load(réponse)


def existing_team_names(api: str, nom_compétition: str, saison: str) -> Tuple[Optional[int], List[str]]:
    """Équipes déjà enregistrées pour cette compétition, s'il y en a une."""
    try:
        compétitions = app_get(api, "/sport/competitions")
    except Exception:
        return None, []
    for compétition in compétitions:
        if (compétition.get("name") == nom_compétition
                and (compétition.get("season") or "") == saison):
            identifiant = compétition["id"]
            try:
                équipes = app_get(api, f"/sport/teams?competition_id={identifiant}")
            except Exception:
                return identifiant, []
            return identifiant, [é["name"] for é in équipes]
    return None, []


# ═══════════════════════════════════════════════════════════════════════════
#  PROGRAMME
# ═══════════════════════════════════════════════════════════════════════════

def coverage_report(lignes: List[dict], upcoming: bool = False) -> Dict[str, Tuple[int, int]]:
    """Couverture réelle, champ par champ.

    C'est le chiffre qui compte : la variante xG du laboratoire est restée
    inerte des semaines parce que personne ne mesurait sa couverture.

    Sur des affiches à venir, score et statistiques n'existent pas encore :
    les afficher à 0 % serait un reproche adressé à la source pour une donnée
    qu'elle ne peut pas avoir.
    """
    champs = (
        (("cotes 1X2", ("AvgH", "AvgCH")), ("cotes 2,5 buts", ("Avg>2.5", "AvgC>2.5")))
        if upcoming else
        (("score", ("FTHG",)), ("tirs cadrés", ("HST", "AST")),
         ("tirs", ("HS", "AS")), ("xG", ("HXG", "AXG")),
         ("cotes 1X2", ("AvgH", "AvgCH")), ("cotes 2,5 buts", ("Avg>2.5", "AvgC>2.5")))
    )
    rapport = {}
    for étiquette, colonnes in champs:
        remplies = sum(
            1 for ligne in lignes
            if any(ligne.get(colonne) not in (None, "") for colonne in colonnes)
        )
        rapport[étiquette] = (remplies, len(lignes))
    return rapport


def print_coverage(rapport: Dict[str, Tuple[int, int]]) -> None:
    print("\n   Couverture mesurée :")
    for étiquette, (remplies, total) in rapport.items():
        part = (remplies / total * 100) if total else 0.0
        drapeau = "  " if part >= 95 else (" !" if part > 0 else " ✗")
        print(f"     {étiquette:16} {remplies:4}/{total:<4} {part:5.1f} %{drapeau}")
    if "xG" in rapport and rapport["xG"][0] == 0:
        print("     → xG absente de cette ligue/saison : la variante « xG » du "
              "laboratoire restera inerte. Ce n'est pas un bug du modèle.")


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Récupère matchs, statistiques et cotes depuis API-Football.",
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__,
    )
    analyseur.add_argument("--league", type=int, help="Identifiant de ligue (voir --find-league)")
    analyseur.add_argument("--season", type=int, help="Année d'ouverture, ex. 2025 pour 2025/2026")
    analyseur.add_argument("--name", help="Nom de la compétition en base (défaut : celui de l'API)")
    analyseur.add_argument("--upcoming", action="store_true",
                           help="Les affiches à venir au lieu des matchs joués")
    analyseur.add_argument("--stats", type=int, default=0, metavar="N",
                           help="Récupérer les statistiques (xG, tirs) des N derniers "
                                "matchs joués — 1 requête par match")
    analyseur.add_argument("--no-odds", action="store_true", help="Ne pas récupérer les cotes")
    analyseur.add_argument("--closing", action="store_true",
                           help="Enregistrer les cotes comme cotes de CLÔTURE. "
                                "À n'utiliser que juste avant le coup d'envoi")
    analyseur.add_argument("--api", default=DEFAULT_API, help=f"URL de l'application (défaut : {DEFAULT_API})")
    analyseur.add_argument("--budget", type=int, default=90,
                           help="Requêtes autorisées pour cette exécution (défaut : 90)")
    analyseur.add_argument("--aliases", help="Fichier JSON de correspondances de noms d'équipe")
    analyseur.add_argument("--out", help="Répertoire où conserver le CSV produit")
    analyseur.add_argument("--dry-run", action="store_true", help="Ne rien envoyer à l'application")
    analyseur.add_argument("--rapidapi", action="store_true", help="Clé souscrite via RapidAPI")
    analyseur.add_argument("--status", action="store_true", help="Offre et quota restant — 1 requête")
    analyseur.add_argument("--find-league", metavar="NOM", help="Chercher l'identifiant d'une ligue")
    arguments = analyseur.parse_args()

    clé = os.environ.get("API_FOOTBALL_KEY") or os.environ.get("APIFOOTBALL_KEY")
    if not clé:
        print("Clé absente. Définissez API_FOOTBALL_KEY sans l'écrire dans le dépôt :")
        print('  PowerShell : $env:API_FOOTBALL_KEY="votre-clé"')
        print("  bash       : export API_FOOTBALL_KEY=votre-clé")
        return 2

    client = ApiFootball(clé, rapidapi=arguments.rapidapi, budget=arguments.budget)

    try:
        if arguments.status:
            corps = client.get("status", {}, cacheable=False)
            compte = corps.get("response") or {}
            abonnement = compte.get("subscription") or {}
            requêtes = compte.get("requests") or {}
            print(f"Offre        : {abonnement.get('plan')} ({abonnement.get('active')})")
            print(f"Requêtes     : {requêtes.get('current')} / {requêtes.get('limit_day')} aujourd'hui")
            return 0

        if arguments.find_league:
            corps = client.get("leagues", {"search": arguments.find_league})
            for entrée in corps.get("response") or []:
                ligue = entrée.get("league") or {}
                pays = (entrée.get("country") or {}).get("name")
                saisons = [str(s.get("year")) for s in entrée.get("seasons") or []][-4:]
                print(f"  {ligue.get('id'):>5}  {ligue.get('name'):32} {pays:20} "
                      f"saisons {', '.join(saisons)}")
            return 0

        if not arguments.league or not arguments.season:
            analyseur.error("--league et --season sont requis (voir --find-league)")

        return run(client, arguments)

    except PlanError as erreur:
        print(f"\nOffre insuffisante pour cet appel : {erreur}")
        print("API-Football répond « 200 » dans ce cas : ce n'est PAS une absence de")
        print("données, c'est un refus. Les cotes et les statistiques sont souvent")
        print("hors du palier gratuit — vérifiez avec --status avant de conclure.")
        return 3
    except QuotaError as erreur:
        print(f"\nQuota épuisé : {erreur}")
        print("Le cache conserve tout ce qui a déjà été obtenu : relancez demain.")
        return 4
    except BudgetExhausted as erreur:
        print(f"\n{erreur}")
        return 0
    except urllib.error.URLError as erreur:
        print(f"\nRéseau : {erreur}")
        return 5


def run(client: ApiFootball, arguments) -> int:
    saison = season_label(arguments.season)
    print(f"→ ligue {arguments.league}, saison {saison}…", flush=True)

    entrées = client.get_all("fixtures", {"league": arguments.league,
                                          "season": arguments.season})
    if not entrées:
        print("   Aucun match renvoyé pour cette ligue et cette saison.")
        return 0

    nom_api = (((entrées[0].get("league") or {}).get("name")) or "").strip()
    nom_compétition = arguments.name or nom_api or f"Ligue {arguments.league}"
    div = str(arguments.league)

    lignes, ignorés = [], 0
    for entrée in entrées:
        ligne = fixture_row(entrée, div)
        if ligne is None:
            ignorés += 1
            continue
        joué = ligne["FTHG"] != ""
        if joué == arguments.upcoming:
            continue
        ligne["_fixture_id"] = ((entrée.get("fixture") or {}).get("id"))
        lignes.append(ligne)

    quoi = "affiches à venir" if arguments.upcoming else "matchs joués"
    print(f"   {len(lignes)} {quoi} retenus ({ignorés} ni joués ni programmés, écartés)")
    if not lignes:
        return 0

    # ── garde-fou sur les noms d'équipe ─────────────────────────────────────
    aliases = {}
    if arguments.aliases and Path(arguments.aliases).exists():
        aliases = json.loads(Path(arguments.aliases).read_text(encoding="utf-8"))

    identifiant, noms_base = existing_team_names(arguments.api, nom_compétition, saison)
    if noms_base:
        noms_source = sorted({l["HomeTeam"] for l in lignes} | {l["AwayTeam"] for l in lignes})
        sûres, orphelins, propositions = build_team_mapping(noms_source, noms_base, aliases)
        if orphelins or propositions:
            chemin = Path(arguments.aliases or "api_football_aliases.json")
            brouillon = dict(aliases)
            brouillon.update(propositions)
            for nom in orphelins:
                brouillon.setdefault(nom, "")
            chemin.write_text(json.dumps(brouillon, indent=2, ensure_ascii=False),
                              encoding="utf-8")
            print(f"\n   ARRÊT — {len(orphelins) + len(propositions)} nom(s) d'équipe ne "
                  f"correspondent pas à ceux déjà en base pour « {nom_compétition} {saison} ».")
            print("   L'application apparie les équipes sur leur nom exact : importer")
            print("   ainsi créerait des doublons et couperait l'historique en deux,")
            print("   sans qu'aucun écran ne le signale.")
            if propositions:
                print("\n   Rapprochements proposés (à relire) :")
                for source, cible in sorted(propositions.items()):
                    print(f"     {source:34} → {cible}")
            if orphelins:
                print("\n   Sans équivalent trouvé :")
                for nom in orphelins:
                    print(f"     {nom}")
                print(f"     (noms en base : {', '.join(sorted(noms_base))})")
            print(f"\n   Un brouillon est écrit dans {chemin} : complétez-le, puis")
            print(f"   relancez avec --aliases {chemin}")
            return 6
        for ligne in lignes:
            ligne["HomeTeam"] = sûres.get(ligne["HomeTeam"], ligne["HomeTeam"])
            ligne["AwayTeam"] = sûres.get(ligne["AwayTeam"], ligne["AwayTeam"])
        print(f"   {len(noms_base)} équipes déjà en base, tous les noms appariés")
    elif identifiant:
        print(f"   compétition {identifiant} connue mais sans équipe : rien à apparier")
    else:
        print("   nouvelle compétition : les équipes seront créées telles quelles")

    # ── statistiques, du plus récent au plus ancien ──────────────────────────
    if arguments.stats and not arguments.upcoming:
        cibles = sorted(lignes, key=lambda l: l["Date"].split("/")[::-1], reverse=True)
        cibles = cibles[: arguments.stats]
        print(f"   statistiques : {len(cibles)} match(s), 1 requête chacun…", flush=True)
        obtenues = 0
        for ligne in cibles:
            try:
                corps = client.get("fixtures/statistics",
                                   {"fixture": ligne["_fixture_id"]})
            except BudgetExhausted as erreur:
                print(f"   arrêt sur budget après {obtenues} match(s) — {erreur}")
                break
            if apply_statistics(ligne, corps.get("response")):
                obtenues += 1
        print(f"   statistiques obtenues pour {obtenues} match(s)")

    # ── cotes ───────────────────────────────────────────────────────────────
    if not arguments.no_odds:
        cibles = lignes if arguments.upcoming else []
        if cibles:
            print(f"   cotes : {len(cibles)} match(s), 1 requête chacun…", flush=True)
            books = set()
            for ligne in cibles:
                try:
                    corps = client.get("odds", {"fixture": ligne["_fixture_id"]})
                except BudgetExhausted as erreur:
                    print(f"   arrêt sur budget — {erreur}")
                    break
                except PlanError as erreur:
                    print(f"   cotes hors de votre offre : {erreur}")
                    break
                books.update(apply_odds(ligne, corps.get("response"), arguments.closing))
            étiquette = "clôture" if arguments.closing else "ouverture"
            print(f"   cotes ({étiquette}) : {', '.join(sorted(books)) or 'aucune'}")
        elif not arguments.upcoming:
            print("   cotes ignorées : sur des matchs déjà joués, API-Football ne")
            print("   restitue pas la ligne de clôture — football-data.co.uk, si.")

    for ligne in lignes:
        ligne.pop("_fixture_id", None)
        ligne.pop("_home_id", None)

    texte = to_csv(lignes)
    print_coverage(coverage_report(lignes, upcoming=arguments.upcoming))

    if arguments.out:
        répertoire = Path(arguments.out)
        répertoire.mkdir(parents=True, exist_ok=True)
        chemin = répertoire / f"apifootball_{arguments.league}_{arguments.season}.csv"
        chemin.write_text(texte, encoding="utf-8")
        print(f"\n   CSV écrit dans {chemin}")

    print(f"\n   Requêtes : {client.spent} envoyées, {client.served} servies par le cache"
          + (f", {client.remaining} restantes côté API" if client.remaining else ""))

    if arguments.dry_run:
        print("   --dry-run : rien n'a été envoyé à l'application.")
        return 0

    charge = {
        "competition_name": nom_compétition, "season": saison,
        "csv_text": texte, "import_odds": True, "closing_odds_only": False,
    }
    try:
        résultat = app_post(arguments.api, "/sport/matches/import", charge)
    except urllib.error.HTTPError as erreur:
        détail = erreur.read().decode("utf-8", errors="replace")[:300]
        print(f"\n   échec de l'import : HTTP {erreur.code} — {détail}")
        return 7
    except Exception as erreur:
        print(f"\n   échec de l'import : {erreur}")
        print(f"   (l'application répond-elle sur {arguments.api} ?)")
        return 7

    print(f"\n   {résultat.get('created', 0)} matchs joués, "
          f"{résultat.get('scheduled_created', 0)} affiches à venir, "
          f"{résultat.get('completed_from_scheduled', 0)} affiches complétées, "
          f"{résultat.get('skipped', 0)} ignorés")
    print(f"   {résultat.get('odds_created', 0)} cotes "
          f"(dont {résultat.get('closing_odds_created', 0)} de clôture)")
    if résultat.get("resolved_forecasts"):
        print(f"   {résultat['resolved_forecasts']} prévision(s) gelée(s) notée(s)")
    print(f"   {résultat.get('schedule_note', '')}")

    if arguments.upcoming:
        print("\nÉtape suivante — geler les prévisions avant le coup d'envoi :")
        print("  le bouton « Geler les matchs à venir » de l'onglet « Laboratoire ».")
    else:
        print("\nÉtape suivante — le banc d'essai de l'onglet « Laboratoire » :")
        print("  la variante « xG » n'a de sens que si la couverture ci-dessus le dit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
