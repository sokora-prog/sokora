"""
SOKORA SPORT — API d'analyse des matchs sportifs (v1)

Outil personnel de parieur / analyste. Trois usages :

1. SAISIR    — compétitions, équipes, matchs (à la main, ou import CSV en masse)
2. ANALYSER  — probabilités par marché, cotes équitables, détection de valeur,
               mise de Kelly, verdict et alertes de fiabilité
3. SUIVRE    — paris joués, bankroll, ROI, drawdown, CLV, bilan par marché

Toute la statistique vit dans `analytics_sport` (module pur, testé) ; ce fichier
ne fait que traduire base de données ↔ moteur d'analyse.
"""

import csv
import io
import os
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from . import analytics_sport as an
from . import calibration_sport as cal
from .database import get_db
from .models_sport import (
    BankrollTransaction, BankrollTxType, BetStatus, Competition, MatchStatus,
    OddsQuote, SportBet, SportForecast, SportMatch, SportTeam,
)

#: Jeton partagé, facultatif. Le module n'a pas de comptes utilisateur : tant
#: qu'il n'écoute que sur la machine locale, c'est sans conséquence. Dès qu'on
#: l'expose au réseau pour qu'un téléphone l'atteigne, toute personne sur le
#: même Wi-Fi peut lire la bankroll et modifier les paris. Définir
#: SPORT_API_TOKEN ferme cette porte sans imposer de gestion de comptes ; laissé
#: vide (défaut), rien ne change pour une utilisation purement locale.
SPORT_API_TOKEN = os.getenv("SPORT_API_TOKEN", "").strip()


def require_token(x_sport_token: str = Header(default="")) -> None:
    """Refuse la requête si un jeton est configuré et ne correspond pas."""
    if not SPORT_API_TOKEN:
        return
    # Comparaison à temps constant : une comparaison naïve laisse fuir la
    # longueur du préfixe correct, ce qui suffit à retrouver le jeton.
    if not secrets.compare_digest(x_sport_token, SPORT_API_TOKEN):
        raise HTTPException(status_code=401, detail="Jeton absent ou invalide.")


router = APIRouter(prefix="/sport", tags=["sport"], dependencies=[Depends(require_token)])

#: Seuil de valeur en dessous duquel on ne parie pas. 3 % d'edge est un
#: minimum réaliste : en dessous, l'erreur du modèle dépasse l'avantage.
DEFAULT_MIN_EDGE = 0.03

DEMO_COMPETITION_NAME = "Championnat Démo"

# ═══════════════════════════════════════════════════════════════════════════
#  COLONNES DE COTES DU FORMAT football-data.co.uk
# ═══════════════════════════════════════════════════════════════════════════
#
# Ces fichiers contiennent, pour chaque match joué, les cotes d'ouverture ET de
# clôture de plusieurs bookmakers. Les cotes de CLÔTURE sont ce qui donne toute
# sa valeur à l'import : sans elles, la calibration n'a aucune barre à franchir.
#
# Conventions du fichier :
#   PS…  Pinnacle (le book le plus « sharp », référence de la clôture)
#   B365 Bet365 · WH William Hill · VC/BW/IW autres opérateurs
#   Max… meilleure cote du marché · Avg… moyenne du marché
#   …C…  variante de clôture (PSCH, AvgCH, B365C>2.5, AHCh…)
#   Bb…  ancien préfixe Betbrain, utilisé jusqu'à la saison 2018/2019
#
# Chaque entrée : colonne → (marché, sélection, bookmaker, cote de clôture ?)

FOOTBALL_DATA_ODDS: Dict[str, Tuple[str, str, str, bool]] = {}


def _register_1x2(prefix: str, bookmaker: str, closing: bool) -> None:
    for suffix, selection in (("H", "HOME"), ("D", "DRAW"), ("A", "AWAY")):
        FOOTBALL_DATA_ODDS[f"{prefix}{suffix}"] = ("1X2", selection, bookmaker, closing)


def _register_totals(prefix: str, bookmaker: str, closing: bool) -> None:
    FOOTBALL_DATA_ODDS[f"{prefix}>2.5"] = ("OU_2.5", "OVER", bookmaker, closing)
    FOOTBALL_DATA_ODDS[f"{prefix}<2.5"] = ("OU_2.5", "UNDER", bookmaker, closing)


for _prefix, _book, _closing in (
    # 1X2 — clôture
    ("PSC", "Pinnacle", True), ("AvgC", "Moyenne", True), ("MaxC", "Meilleure", True),
    ("B365C", "Bet365", True), ("WHC", "William Hill", True), ("VCC", "VC Bet", True),
    ("BWC", "Bwin", True), ("IWC", "Interwetten", True),
    # 1X2 — ouverture
    ("PS", "Pinnacle", False), ("Avg", "Moyenne", False), ("Max", "Meilleure", False),
    ("B365", "Bet365", False), ("WH", "William Hill", False), ("VC", "VC Bet", False),
    ("BW", "Bwin", False), ("IW", "Interwetten", False),
    # Anciennes saisons (préfixe Betbrain)
    ("BbAv", "Moyenne", False), ("BbMx", "Meilleure", False),
):
    _register_1x2(_prefix, _book, _closing)

for _prefix, _book, _closing in (
    ("PC", "Pinnacle", True), ("AvgC", "Moyenne", True), ("MaxC", "Meilleure", True),
    ("B365C", "Bet365", True),
    ("P", "Pinnacle", False), ("Avg", "Moyenne", False), ("Max", "Meilleure", False),
    ("B365", "Bet365", False),
    ("BbAv", "Moyenne", False), ("BbMx", "Meilleure", False),
):
    _register_totals(_prefix, _book, _closing)

#: Handicap asiatique : la ligne vit dans sa propre colonne, les cotes dans
#: deux autres. (colonne_ligne, colonne_domicile, colonne_extérieur, book, clôture)
FOOTBALL_DATA_HANDICAPS: Tuple[Tuple[str, str, str, str, bool], ...] = (
    ("AHCh", "PCAHH", "PCAHA", "Pinnacle", True),
    ("AHCh", "AvgCAHH", "AvgCAHA", "Moyenne", True),
    ("AHCh", "MaxCAHH", "MaxCAHA", "Meilleure", True),
    ("AHCh", "B365CAHH", "B365CAHA", "Bet365", True),
    ("AHh", "PAHH", "PAHA", "Pinnacle", False),
    ("AHh", "AvgAHH", "AvgAHA", "Moyenne", False),
    ("AHh", "MaxAHH", "MaxAHA", "Meilleure", False),
    ("AHh", "B365AHH", "B365AHA", "Bet365", False),
    ("BbAHh", "BbAvAHH", "BbAvAHA", "Moyenne", False),
    ("BbAHh", "BbMxAHH", "BbMxAHA", "Meilleure", False),
)

#: Bookmakers importés par défaut : la référence sharp, la moyenne du marché et
#: la meilleure cote disponible. Importer les vingt colonnes n'apporterait rien
#: qu'un volume de lignes.
DEFAULT_ODDS_BOOKMAKERS = ("Pinnacle", "Moyenne", "Meilleure")

#: Mise en garde affichée dès qu'une mesure porte sur le jeu de démonstration.
#: Ce monde synthétique est engendré par le processus de Poisson que le modèle
#: postule : le modèle y est donc *bien spécifié*, ce qui n'arrive jamais dans
#: la réalité. Ses résultats de calibration y sont flatteurs et ne se
#: transposent pas.
DEMO_CAVEAT = (
    "Ces mesures portent sur le championnat de démonstration, engendré par le "
    "même processus de Poisson que le modèle suppose. Le modèle y est donc "
    "artificiellement bien placé, et le « marché » simulé ne contient aucune "
    "information que le modèle ignore. Sur de vraies données, la cote de "
    "clôture intègre les compositions, les absences et l'argent des "
    "professionnels : elle est bien plus difficile à battre."
)


# ═══════════════════════════════════════════════════════════════════════════
#  SCHÉMAS
# ═══════════════════════════════════════════════════════════════════════════

class CompetitionIn(BaseModel):
    name: str
    sport: str = "football"
    country: Optional[str] = None
    season: Optional[str] = None
    notes: Optional[str] = None


class TeamIn(BaseModel):
    name: str
    competition_id: Optional[int] = None
    short_name: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None


class MatchIn(BaseModel):
    competition_id: Optional[int] = None
    competition_name: Optional[str] = None
    home_team: Optional[str] = None          # nom (créé si absent)
    away_team: Optional[str] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    kickoff: Optional[datetime] = None
    matchday: Optional[int] = None
    status: Optional[MatchStatus] = None
    home_goals: Optional[int] = None
    away_goals: Optional[int] = None
    home_ht_goals: Optional[int] = None
    away_ht_goals: Optional[int] = None
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_shots: Optional[int] = None
    away_shots: Optional[int] = None
    home_shots_on_target: Optional[int] = None
    away_shots_on_target: Optional[int] = None
    home_corners: Optional[int] = None
    away_corners: Optional[int] = None
    home_possession: Optional[float] = None
    away_possession: Optional[float] = None
    home_yellow_cards: Optional[int] = None
    away_yellow_cards: Optional[int] = None
    home_red_cards: Optional[int] = None
    away_red_cards: Optional[int] = None
    context_note: Optional[str] = None
    home_boost: Optional[float] = None
    away_boost: Optional[float] = None


class ResultIn(BaseModel):
    home_goals: int
    away_goals: int
    home_ht_goals: Optional[int] = None
    away_ht_goals: Optional[int] = None
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None
    home_shots: Optional[int] = None
    away_shots: Optional[int] = None
    home_shots_on_target: Optional[int] = None
    away_shots_on_target: Optional[int] = None
    home_corners: Optional[int] = None
    away_corners: Optional[int] = None
    settle_bets: bool = True


class QuoteIn(BaseModel):
    market: str
    selection: str
    odds: float = Field(gt=1.0)
    bookmaker: Optional[str] = None
    is_closing: bool = False


class QuotesIn(BaseModel):
    quotes: List[QuoteIn]
    replace: bool = False        # remplace les cotes existantes du bookmaker


class PredictIn(BaseModel):
    """Analyse à la demande d'une affiche, sans créer le match en base."""
    competition_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    home_team: Optional[str] = None
    away_team: Optional[str] = None
    quotes: List[QuoteIn] = []
    bankroll: Optional[float] = None
    home_boost: float = 1.0
    away_boost: float = 1.0
    half_life_days: float = an.DEFAULT_HALF_LIFE_DAYS
    min_edge: float = DEFAULT_MIN_EDGE
    kelly_fraction: float = 0.25
    market_weight: float = 0.35
    edge_haircut: float = an.DEFAULT_EDGE_HAIRCUT


class BetIn(BaseModel):
    # `model_probability` heurte l'espace de noms réservé « model_ » de Pydantic.
    model_config = ConfigDict(protected_namespaces=())

    market: str
    selection: str
    odds: float = Field(gt=1.0)
    stake: float = Field(gt=0)
    match_id: Optional[int] = None
    label: Optional[str] = None
    bookmaker: Optional[str] = None
    model_probability: Optional[float] = None
    edge: Optional[float] = None
    kelly_stake_pct: Optional[float] = None
    notes: Optional[str] = None
    placed_at: Optional[datetime] = None


class SettleIn(BaseModel):
    status: BetStatus
    profit: Optional[float] = None
    closing_odds: Optional[float] = None


class BankrollIn(BaseModel):
    type: BankrollTxType
    amount: float = Field(gt=0)
    currency: str = "EUR"
    note: Optional[str] = None


class ImportIn(BaseModel):
    """Import CSV de matchs terminés.

    Colonnes reconnues (insensible à la casse, séparateur ``,`` ou ``;``) :
        date, home, away, home_goals, away_goals
    Alias acceptés : HomeTeam/AwayTeam/FTHG/FTAG (format football-data.co.uk),
    ainsi que home_xg, away_xg, home_shots, away_shots, matchday.
    """
    competition_id: Optional[int] = None
    competition_name: Optional[str] = None
    season: Optional[str] = None
    csv_text: str
    #: Importe aussi les colonnes de cotes quand le fichier en contient.
    import_odds: bool = True
    #: Bookmakers retenus ("Pinnacle", "Moyenne", "Meilleure", "Bet365"…).
    odds_bookmakers: Optional[List[str]] = None
    #: Ignorer les cotes d'ouverture et ne garder que celles de clôture.
    closing_odds_only: bool = False


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _get_competition(db: Session, competition_id: int) -> Competition:
    comp = db.get(Competition, competition_id)
    if not comp:
        raise HTTPException(404, "Compétition introuvable")
    return comp


def _get_match(db: Session, match_id: int) -> SportMatch:
    match = db.get(SportMatch, match_id)
    if not match:
        raise HTTPException(404, "Match introuvable")
    return match


def _resolve_competition(
    db: Session,
    competition_id: Optional[int],
    name: Optional[str] = None,
    season: Optional[str] = None,
) -> Competition:
    """Récupère une compétition par identifiant, ou la crée depuis son nom."""
    if competition_id:
        return _get_competition(db, competition_id)
    if not name:
        raise HTTPException(400, "competition_id ou competition_name est requis")
    comp = (
        db.query(Competition)
        .filter(Competition.name == name, Competition.season == season)
        .first()
    )
    if not comp:
        comp = Competition(name=name, season=season)
        db.add(comp)
        db.flush()
    return comp


def _resolve_team(
    db: Session,
    competition: Competition,
    team_id: Optional[int] = None,
    name: Optional[str] = None,
) -> SportTeam:
    """Récupère une équipe par identifiant, ou la crée depuis son nom.

    La création à la volée est volontaire : elle permet de saisir un match
    complet en une seule requête, ce qui rend l'import de masse indolore.
    """
    if team_id:
        team = db.get(SportTeam, team_id)
        if not team:
            raise HTTPException(404, f"Équipe {team_id} introuvable")
        return team
    if not name or not name.strip():
        raise HTTPException(400, "Nom d'équipe manquant")
    name = name.strip()
    team = (
        db.query(SportTeam)
        .filter(SportTeam.competition_id == competition.id, SportTeam.name == name)
        .first()
    )
    if not team:
        team = SportTeam(name=name, competition_id=competition.id)
        db.add(team)
        db.flush()
    return team


def _team_names(db: Session, competition_id: Optional[int] = None) -> Dict[int, str]:
    q = db.query(SportTeam)
    if competition_id:
        q = q.filter(SportTeam.competition_id == competition_id)
    return {t.id: t.name for t in q.all()}


def _match_record(match: SportMatch) -> an.MatchRecord:
    """Convertit un match en unité de calcul pour le moteur.

    Point de passage unique : reconstruire cet objet à la main ailleurs revient
    tôt ou tard à oublier un champ — les tirs, par exemple, dont l'absence
    ferait silencieusement retomber toutes les variantes du modèle sur les buts.
    """
    return an.MatchRecord(
        home=match.home_team_id,
        away=match.away_team_id,
        home_goals=match.home_goals,
        away_goals=match.away_goals,
        kickoff=match.kickoff,
        competition=match.competition_id,
        home_xg=match.home_xg,
        away_xg=match.away_xg,
        home_shots=match.home_shots,
        away_shots=match.away_shots,
        home_shots_on_target=match.home_shots_on_target,
        away_shots_on_target=match.away_shots_on_target,
    )


def _history(
    db: Session,
    competition_id: Optional[int] = None,
    before: Optional[datetime] = None,
) -> List[an.MatchRecord]:
    """Historique des matchs terminés, converti pour le moteur d'analyse.

    ``before`` permet une analyse honnête d'un match passé : on n'utilise que
    ce qui était connu avant le coup d'envoi (pas de fuite d'information).
    """
    q = db.query(SportMatch).filter(SportMatch.status == MatchStatus.FINISHED)
    if competition_id:
        q = q.filter(SportMatch.competition_id == competition_id)
    if before:
        q = q.filter(SportMatch.kickoff < before)
    return [
        _match_record(m) for m in q.all()
        if m.home_goals is not None and m.away_goals is not None
    ]


def _quotes_payload(match: SportMatch, closing: Optional[bool] = None) -> List[dict]:
    """Cotes d'un match au format attendu par le détecteur de valeur."""
    quotes = match.odds_quotes
    if closing is not None:
        quotes = [q for q in quotes if bool(q.is_closing) == closing]
    return [
        {
            "market": q.market,
            "selection": q.selection,
            "odds": q.odds,
            "bookmaker": q.bookmaker,
            "captured_at": q.captured_at.isoformat() if q.captured_at else None,
        }
        for q in quotes
    ]


def _current_bankroll(db: Session) -> dict:
    """Bankroll courante = dépôts − retraits + profits nets des paris réglés."""
    deposits = withdrawals = adjustments = 0.0
    for tx in db.query(BankrollTransaction).all():
        if tx.type == BankrollTxType.DEPOSIT:
            deposits += tx.amount
        elif tx.type == BankrollTxType.WITHDRAWAL:
            withdrawals += tx.amount
        else:
            adjustments += tx.amount
    bets = [_bet_record(b) for b in db.query(SportBet).all()]
    profit = sum(b.net_profit() for b in bets if b.is_settled())
    pending = sum(b.stake for b in bets if not b.is_settled())
    capital = deposits - withdrawals + adjustments
    return {
        "deposits": round(deposits, 2),
        "withdrawals": round(withdrawals, 2),
        "adjustments": round(adjustments, 2),
        "starting_capital": round(capital, 2),
        "realised_profit": round(profit, 2),
        "balance": round(capital + profit, 2),
        "exposure": round(pending, 2),
        "available": round(capital + profit - pending, 2),
    }


def _bet_record(bet: SportBet) -> an.BetRecord:
    return an.BetRecord(
        stake=bet.stake,
        odds=bet.odds,
        status=bet.status.value if hasattr(bet.status, "value") else str(bet.status),
        profit=bet.profit,
        market=bet.market,
        selection=bet.selection,
        model_prob=bet.model_probability,
        closing_odds=bet.closing_odds,
        placed_at=bet.placed_at,
        label=bet.label or "",
    )


def _match_out(match: SportMatch, names: Optional[Dict[int, str]] = None) -> dict:
    names = names or {}
    return {
        "id": match.id,
        "competition_id": match.competition_id,
        "competition": match.competition.name if match.competition else None,
        "home_team_id": match.home_team_id,
        "away_team_id": match.away_team_id,
        "home_team": names.get(match.home_team_id) or (match.home_team.name if match.home_team else None),
        "away_team": names.get(match.away_team_id) or (match.away_team.name if match.away_team else None),
        "kickoff": match.kickoff.isoformat() if match.kickoff else None,
        "matchday": match.matchday,
        "status": match.status.value if hasattr(match.status, "value") else match.status,
        "home_goals": match.home_goals,
        "away_goals": match.away_goals,
        "score": (
            f"{match.home_goals}-{match.away_goals}"
            if match.home_goals is not None and match.away_goals is not None else None
        ),
        "home_xg": match.home_xg,
        "away_xg": match.away_xg,
        "home_shots": match.home_shots,
        "away_shots": match.away_shots,
        "home_shots_on_target": match.home_shots_on_target,
        "away_shots_on_target": match.away_shots_on_target,
        "home_corners": match.home_corners,
        "away_corners": match.away_corners,
        "context_note": match.context_note,
        "home_boost": match.home_boost,
        "away_boost": match.away_boost,
        "odds_count": len(match.odds_quotes),
        "bets_count": len(match.bets),
    }


def _bet_out(bet: SportBet) -> dict:
    record = _bet_record(bet)
    return {
        "id": bet.id,
        "match_id": bet.match_id,
        "label": bet.label,
        "market": bet.market,
        "selection": bet.selection,
        "odds": bet.odds,
        "stake": bet.stake,
        "bookmaker": bet.bookmaker,
        "status": bet.status.value if hasattr(bet.status, "value") else bet.status,
        "profit": round(record.net_profit(), 2),
        "potential_return": round(bet.stake * bet.odds, 2),
        "model_probability": bet.model_probability,
        "edge": bet.edge,
        "kelly_stake_pct": bet.kelly_stake_pct,
        "closing_odds": bet.closing_odds,
        "clv_pct": (
            round((bet.closing_odds / bet.odds - 1) * 100, 2)
            if bet.closing_odds and bet.odds else None
        ),
        "notes": bet.notes,
        "placed_at": bet.placed_at.isoformat() if bet.placed_at else None,
        "settled_at": bet.settled_at.isoformat() if bet.settled_at else None,
    }


def _apply_match_fields(match: SportMatch, payload: BaseModel, exclude: set = frozenset()) -> None:
    skip = {
        "competition_id", "competition_name", "home_team", "away_team",
        "home_team_id", "away_team_id", "settle_bets",
    } | set(exclude)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in skip or value is None:
            continue
        setattr(match, field, value)


# ═══════════════════════════════════════════════════════════════════════════
#  COMPÉTITIONS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/competitions")
def list_competitions(db: Session = Depends(get_db)):
    out = []
    for c in db.query(Competition).order_by(Competition.name).all():
        finished = sum(1 for m in c.matches if m.is_played)
        out.append({
            "id": c.id, "name": c.name, "sport": c.sport, "country": c.country,
            "season": c.season, "is_active": c.is_active, "notes": c.notes,
            "teams_count": len(c.teams),
            "matches_count": len(c.matches),
            "finished_count": finished,
        })
    return out


@router.post("/competitions", status_code=201)
def create_competition(payload: CompetitionIn, db: Session = Depends(get_db)):
    exists = (
        db.query(Competition)
        .filter(Competition.name == payload.name, Competition.season == payload.season)
        .first()
    )
    if exists:
        raise HTTPException(409, "Cette compétition existe déjà pour cette saison")
    comp = Competition(**payload.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return {"id": comp.id, "name": comp.name, "season": comp.season}


@router.put("/competitions/{competition_id}")
def update_competition(competition_id: int, payload: CompetitionIn, db: Session = Depends(get_db)):
    comp = _get_competition(db, competition_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(comp, field, value)
    db.commit()
    return {"id": comp.id, "updated": True}


@router.delete("/competitions/{competition_id}")
def delete_competition(competition_id: int, db: Session = Depends(get_db)):
    comp = _get_competition(db, competition_id)
    db.delete(comp)
    db.commit()
    return {"deleted": True}


@router.get("/competitions/{competition_id}/table")
def competition_table(competition_id: int, db: Session = Depends(get_db)):
    """Classement calculé + colonnes utiles au parieur (PPG domicile/extérieur,
    taux over 2.5, taux BTTS, forme) et forces du modèle."""
    _get_competition(db, competition_id)
    history = _history(db, competition_id)
    names = _team_names(db, competition_id)
    strengths, baseline = an.team_strengths(history)
    rows = an.standings(history, names)
    for row in rows:
        st = strengths.get(row["team"])
        row["attack"] = round(st.attack, 3) if st else None
        row["defense"] = round(st.defense, 3) if st else None
        row["team_id"] = row.pop("team")
    return {"baseline": baseline.as_dict(), "table": rows}


# ═══════════════════════════════════════════════════════════════════════════
#  ÉQUIPES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/teams")
def list_teams(competition_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(SportTeam)
    if competition_id:
        q = q.filter(SportTeam.competition_id == competition_id)
    return [
        {
            "id": t.id, "name": t.name, "short_name": t.short_name,
            "competition_id": t.competition_id, "country": t.country, "notes": t.notes,
        }
        for t in q.order_by(SportTeam.name).all()
    ]


@router.post("/teams", status_code=201)
def create_team(payload: TeamIn, db: Session = Depends(get_db)):
    exists = (
        db.query(SportTeam)
        .filter(SportTeam.competition_id == payload.competition_id,
                SportTeam.name == payload.name)
        .first()
    )
    if exists:
        raise HTTPException(409, "Équipe déjà enregistrée dans cette compétition")
    team = SportTeam(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name}


@router.put("/teams/{team_id}")
def update_team(team_id: int, payload: TeamIn, db: Session = Depends(get_db)):
    team = db.get(SportTeam, team_id)
    if not team:
        raise HTTPException(404, "Équipe introuvable")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    db.commit()
    return {"id": team.id, "updated": True}


@router.delete("/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db)):
    team = db.get(SportTeam, team_id)
    if not team:
        raise HTTPException(404, "Équipe introuvable")
    db.delete(team)
    db.commit()
    return {"deleted": True}


@router.get("/teams/{team_id}/stats")
def team_stats(
    team_id: int,
    last: int = Query(10, ge=1, le=100, description="Nombre de matchs récents"),
    db: Session = Depends(get_db),
):
    """Fiche statistique complète d'une équipe : forme globale, à domicile, à
    l'extérieur, forces du modèle, Elo et tendance sur la saison."""
    team = db.get(SportTeam, team_id)
    if not team:
        raise HTTPException(404, "Équipe introuvable")

    history = _history(db, team.competition_id)
    names = _team_names(db, team.competition_id)
    strengths, baseline = an.team_strengths(history)
    st = strengths.get(team_id)
    elo = an.elo_ratings(history)

    def readable(form: dict) -> dict:
        for row in form.get("last_results", []):
            row["opponent"] = names.get(row["opponent"], row["opponent"])
        return form

    return {
        "team": {"id": team.id, "name": team.name, "competition_id": team.competition_id},
        "baseline": baseline.as_dict(),
        "strength": st.as_dict() if st else None,
        "elo": round(elo.get(team_id, 1500.0), 1),
        "form_overall": readable(an.team_form(history, team_id, last)),
        "form_home": readable(an.team_form(history, team_id, last, venue="HOME")),
        "form_away": readable(an.team_form(history, team_id, last, venue="AWAY")),
        "season_overall": readable(an.team_form(history, team_id, None)),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  MATCHS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/matches")
def list_matches(
    competition_id: Optional[int] = None,
    status: Optional[MatchStatus] = None,
    team_id: Optional[int] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(SportMatch)
    if competition_id:
        q = q.filter(SportMatch.competition_id == competition_id)
    if status:
        q = q.filter(SportMatch.status == status)
    if team_id:
        q = q.filter(
            (SportMatch.home_team_id == team_id) | (SportMatch.away_team_id == team_id)
        )
    matches = q.order_by(desc(SportMatch.kickoff), desc(SportMatch.id)).limit(limit).all()
    names = _team_names(db)
    return [_match_out(m, names) for m in matches]


@router.post("/matches", status_code=201)
def create_match(payload: MatchIn, db: Session = Depends(get_db)):
    """Crée un match. Les équipes inconnues sont créées automatiquement."""
    comp = _resolve_competition(db, payload.competition_id, payload.competition_name)
    home = _resolve_team(db, comp, payload.home_team_id, payload.home_team)
    away = _resolve_team(db, comp, payload.away_team_id, payload.away_team)
    if home.id == away.id:
        raise HTTPException(400, "Une équipe ne peut pas jouer contre elle-même")

    match = SportMatch(
        competition_id=comp.id, home_team_id=home.id, away_team_id=away.id,
    )
    _apply_match_fields(match, payload)
    if payload.status is None:
        match.status = (
            MatchStatus.FINISHED
            if payload.home_goals is not None and payload.away_goals is not None
            else MatchStatus.SCHEDULED
        )
    db.add(match)
    db.commit()
    db.refresh(match)
    return _match_out(match)


@router.put("/matches/{match_id}")
def update_match(match_id: int, payload: MatchIn, db: Session = Depends(get_db)):
    match = _get_match(db, match_id)
    if payload.home_team or payload.home_team_id:
        match.home_team_id = _resolve_team(
            db, match.competition, payload.home_team_id, payload.home_team).id
    if payload.away_team or payload.away_team_id:
        match.away_team_id = _resolve_team(
            db, match.competition, payload.away_team_id, payload.away_team).id
    _apply_match_fields(match, payload)
    db.commit()
    db.refresh(match)
    return _match_out(match)


@router.delete("/matches/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db)):
    match = _get_match(db, match_id)
    db.delete(match)
    db.commit()
    return {"deleted": True}


@router.put("/matches/{match_id}/result")
def set_result(match_id: int, payload: ResultIn, db: Session = Depends(get_db)):
    """Enregistre le score final et règle automatiquement les paris liés."""
    match = _get_match(db, match_id)
    _apply_match_fields(match, payload)
    match.status = MatchStatus.FINISHED

    resolved_forecasts = _resolve_forecasts(
        db, match, payload.home_goals, payload.away_goals
    )

    settled = []
    if payload.settle_bets:
        for bet in match.bets:
            if bet.status != BetStatus.PENDING:
                continue
            verdict = an.settle_selection(
                bet.market, bet.selection, payload.home_goals, payload.away_goals
            )
            if verdict is None:
                continue
            bet.status = BetStatus(verdict)
            bet.profit = round(_bet_record(bet).net_profit(), 2)
            bet.settled_at = datetime.now(timezone.utc)
            settled.append({"bet_id": bet.id, "status": verdict, "profit": bet.profit})

    db.commit()
    db.refresh(match)
    return {
        "match": _match_out(match),
        "settled_bets": settled,
        "resolved_forecasts": resolved_forecasts,
    }


def _extract_row_odds(
    row: dict,
    columns: Dict[str, str],
    bookmakers: Sequence[str],
    closing_only: bool,
) -> List[dict]:
    """Cotes contenues dans une ligne de CSV football-data.co.uk.

    Les cotes de clôture sont la partie précieuse : ce sont elles qui donnent
    une barre à franchir à la calibration. Les cotes d'ouverture servent, elles,
    à mesurer le mouvement de la ligne.
    """
    quotes: List[dict] = []

    def read_odds(column_name: str) -> Optional[float]:
        real = columns.get(column_name.lower())
        if not real:
            return None
        raw = row.get(real)
        if raw is None or str(raw).strip() == "":
            return None
        try:
            value = float(str(raw).strip().replace(",", "."))
        except ValueError:
            return None
        return value if value > 1.0 else None

    for column, (market, selection, bookmaker, is_closing) in FOOTBALL_DATA_ODDS.items():
        if bookmaker not in bookmakers or (closing_only and not is_closing):
            continue
        odds = read_odds(column)
        if odds is None:
            continue
        quotes.append({
            "market": market, "selection": selection,
            "odds": odds, "bookmaker": bookmaker, "is_closing": is_closing,
        })

    for line_column, home_column, away_column, bookmaker, is_closing in FOOTBALL_DATA_HANDICAPS:
        if bookmaker not in bookmakers or (closing_only and not is_closing):
            continue
        real_line = columns.get(line_column.lower())
        if not real_line:
            continue
        raw_line = row.get(real_line)
        if raw_line is None or str(raw_line).strip() == "":
            continue
        try:
            line = float(str(raw_line).strip().replace(",", "."))
        except ValueError:
            continue
        home_odds, away_odds = read_odds(home_column), read_odds(away_column)
        if home_odds is None or away_odds is None:
            continue
        # Même convention que le moteur : la ligne s'ajoute à l'écart de buts
        # vu du domicile, donc « domicile −0,5 » s'écrit AH_-0.5.
        market = f"AH_{float(line)}"
        quotes.append({
            "market": market, "selection": "HOME", "odds": home_odds,
            "bookmaker": bookmaker, "is_closing": is_closing,
        })
        quotes.append({
            "market": market, "selection": "AWAY", "odds": away_odds,
            "bookmaker": bookmaker, "is_closing": is_closing,
        })

    return quotes


@router.post("/matches/import")
def import_matches(payload: ImportIn, db: Session = Depends(get_db)):
    """Import CSV de matchs terminés (voir `ImportIn` pour les colonnes)."""
    comp = _resolve_competition(
        db, payload.competition_id, payload.competition_name, payload.season
    )
    text = payload.csv_text.strip()
    if not text:
        raise HTTPException(400, "CSV vide")

    sample = text.split("\n", 1)[0]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise HTTPException(400, "En-tête CSV illisible")

    aliases = {
        "date": ("date", "kickoff", "datetime", "match_date"),
        "home": ("home", "home_team", "hometeam", "domicile", "team_home"),
        "away": ("away", "away_team", "awayteam", "exterieur", "extérieur", "team_away"),
        "home_goals": ("home_goals", "fthg", "hg", "buts_domicile", "home_score"),
        "away_goals": ("away_goals", "ftag", "ag", "buts_exterieur", "away_score"),
        "home_ht_goals": ("home_ht_goals", "hthg"),
        "away_ht_goals": ("away_ht_goals", "htag"),
        "home_xg": ("home_xg", "hxg", "xg_home"),
        "away_xg": ("away_xg", "axg", "xg_away"),
        "home_shots": ("home_shots", "hs"),
        "away_shots": ("away_shots", "as"),
        "home_shots_on_target": ("home_shots_on_target", "hst"),
        "away_shots_on_target": ("away_shots_on_target", "ast"),
        "home_corners": ("home_corners", "hc"),
        "away_corners": ("away_corners", "ac"),
        "matchday": ("matchday", "round", "journee", "journée"),
    }
    lowered = {(name or "").strip().lower(): name for name in reader.fieldnames}
    mapping = {
        field: lowered[alias]
        for field, candidates in aliases.items()
        for alias in candidates
        if alias in lowered
    }
    for required in ("home", "away", "home_goals", "away_goals"):
        if required not in mapping:
            raise HTTPException(
                400,
                f"Colonne « {required} » absente. Colonnes lues : "
                f"{', '.join(reader.fieldnames)}",
            )

    def parse_number(raw, cast):
        if raw is None or str(raw).strip() == "":
            return None
        try:
            return cast(str(raw).strip().replace(",", "."))
        except ValueError:
            return None

    def parse_date(raw):
        if not raw or not str(raw).strip():
            return None
        raw = str(raw).strip()
        formats = (
            "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%d-%m-%Y",
        )
        for fmt in formats:
            try:
                return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None

    bookmakers = tuple(payload.odds_bookmakers or DEFAULT_ODDS_BOOKMAKERS)
    wants_odds = payload.import_odds and bool(
        set(FOOTBALL_DATA_ODDS) & {name.strip() for name in reader.fieldnames}
    )

    created = skipped = 0
    errors: List[str] = []
    pending_odds: List[Tuple[SportMatch, List[dict]]] = []
    for index, row in enumerate(reader, start=2):
        home_name = (row.get(mapping["home"]) or "").strip()
        away_name = (row.get(mapping["away"]) or "").strip()
        hg = parse_number(row.get(mapping["home_goals"]), int)
        ag = parse_number(row.get(mapping["away_goals"]), int)
        if not home_name or not away_name or hg is None or ag is None:
            skipped += 1
            if len(errors) < 10:
                errors.append(f"ligne {index} : équipes ou score manquants")
            continue

        home = _resolve_team(db, comp, name=home_name)
        away = _resolve_team(db, comp, name=away_name)
        if home.id == away.id:
            skipped += 1
            continue
        kickoff = parse_date(row.get(mapping["date"])) if "date" in mapping else None

        # Dédoublonnage : même affiche, même date → on ignore.
        duplicate = (
            db.query(SportMatch)
            .filter(
                SportMatch.competition_id == comp.id,
                SportMatch.home_team_id == home.id,
                SportMatch.away_team_id == away.id,
                SportMatch.kickoff == kickoff,
            )
            .first()
        )
        if duplicate:
            skipped += 1
            continue

        match = SportMatch(
            competition_id=comp.id, home_team_id=home.id, away_team_id=away.id,
            kickoff=kickoff, status=MatchStatus.FINISHED,
            home_goals=hg, away_goals=ag,
        )
        for field, cast in (
            ("home_ht_goals", int), ("away_ht_goals", int),
            ("home_xg", float), ("away_xg", float),
            ("home_shots", int), ("away_shots", int),
            ("home_shots_on_target", int), ("away_shots_on_target", int),
            ("home_corners", int), ("away_corners", int),
            ("matchday", int),
        ):
            if field in mapping:
                value = parse_number(row.get(mapping[field]), cast)
                if value is not None:
                    setattr(match, field, value)
        db.add(match)
        created += 1

        if wants_odds:
            quotes = _extract_row_odds(row, lowered, bookmakers, payload.closing_odds_only)
            if quotes:
                pending_odds.append((match, quotes))

    # Les identifiants de match ne sont attribués qu'au flush : on écrit donc
    # les cotes en une seule passe, après.
    odds_created = closing_created = 0
    if pending_odds:
        db.flush()
        for match, quotes in pending_odds:
            for quote in quotes:
                db.add(OddsQuote(
                    match_id=match.id,
                    market=quote["market"],
                    selection=quote["selection"],
                    odds=quote["odds"],
                    bookmaker=quote["bookmaker"],
                    is_closing=quote["is_closing"],
                    captured_at=match.kickoff,
                ))
                odds_created += 1
                if quote["is_closing"]:
                    closing_created += 1

    db.commit()
    return {
        "competition_id": comp.id,
        "competition": comp.name,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "teams_total": db.query(SportTeam).filter(SportTeam.competition_id == comp.id).count(),
        "odds_created": odds_created,
        "closing_odds_created": closing_created,
        "odds_bookmakers": list(bookmakers) if wants_odds else [],
        "odds_note": (
            "Cotes de clôture importées : la calibration peut confronter le "
            "modèle au marché sur ces matchs."
            if closing_created else
            "Aucune cote de clôture dans ce fichier — la calibration restera "
            "sans barre à franchir."
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  COTES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/matches/{match_id}/odds")
def list_odds(match_id: int, db: Session = Depends(get_db)):
    match = _get_match(db, match_id)
    quotes = sorted(match.odds_quotes, key=lambda q: (q.market, q.selection))
    grouped: Dict[str, List[dict]] = {}
    for q in quotes:
        grouped.setdefault(q.market, []).append({
            "id": q.id, "selection": q.selection, "odds": q.odds,
            "bookmaker": q.bookmaker, "is_closing": q.is_closing,
            "captured_at": q.captured_at.isoformat() if q.captured_at else None,
        })
    # La marge n'a de sens que pour un book donné : additionner les cotes de six
    # opérateurs donnerait un « 500 % » qui ne veut rien dire.
    margins: Dict[str, Optional[float]] = {}
    margin_detail: Dict[str, List[dict]] = {}
    for market, rows in grouped.items():
        by_book: Dict[Tuple[str, bool], List[float]] = {}
        for row in rows:
            key = (row["bookmaker"] or "—", bool(row["is_closing"]))
            by_book.setdefault(key, []).append(row["odds"])
        detail = []
        for (bookmaker, is_closing), odds in by_book.items():
            value = an.overround(odds)
            if value is None:
                continue
            detail.append({
                "bookmaker": bookmaker,
                "is_closing": is_closing,
                "margin": round(value, 4),
                "selections": len(odds),
            })
        detail.sort(key=lambda d: d["margin"])
        margin_detail[market] = detail
        # La marge retenue est la plus faible : celle du book le plus serré.
        margins[market] = detail[0]["margin"] if detail else None

    return {
        "match_id": match_id,
        "markets": grouped,
        "margins": margins,
        "margin_detail": margin_detail,
    }


@router.post("/matches/{match_id}/odds", status_code=201)
def add_odds(match_id: int, payload: QuotesIn, db: Session = Depends(get_db)):
    match = _get_match(db, match_id)
    if payload.replace:
        for q in list(match.odds_quotes):
            db.delete(q)
        db.flush()
    for quote in payload.quotes:
        db.add(OddsQuote(
            match_id=match.id,
            market=quote.market.strip().upper(),
            selection=quote.selection.strip().upper(),
            odds=quote.odds,
            bookmaker=quote.bookmaker,
            is_closing=quote.is_closing,
        ))
    db.commit()
    return {"match_id": match_id, "added": len(payload.quotes)}


@router.delete("/odds/{quote_id}")
def delete_odds(quote_id: int, db: Session = Depends(get_db)):
    quote = db.get(OddsQuote, quote_id)
    if not quote:
        raise HTTPException(404, "Cote introuvable")
    db.delete(quote)
    db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════════
#  CALIBRATION — LE MODÈLE BAT-IL LE MARCHÉ ?
# ═══════════════════════════════════════════════════════════════════════════

#: Ordre de préférence des bookmakers pour lire l'avis du marché. Pinnacle
#: passe en premier : c'est l'opérateur dont la ligne sert de référence à toute
#: l'industrie. Faute de mieux, la moyenne du marché, puis la meilleure cote.
BOOKMAKER_PREFERENCE = ("Pinnacle", "Moyenne", "Meilleure")


def _market_quotes(
    match: SportMatch,
    market_key: str,
    preference: Sequence[str] = BOOKMAKER_PREFERENCE,
) -> Dict[str, float]:
    """Cotes d'un marché pour un match, vues d'un seul bookmaker à la fois.

    Comparer le modèle à un panachage de books n'aurait pas de sens : on
    cherche la ligne **complète** la plus proche possible de la clôture d'un
    opérateur de référence, en descendant l'ordre de préférence.
    """
    lines: Dict[Tuple[str, bool], Dict[str, dict]] = {}
    for quote in match.odds_quotes:
        if quote.market != market_key or not quote.odds or quote.odds <= 1.0:
            continue
        key = (quote.bookmaker or "—", bool(quote.is_closing))
        current = lines.setdefault(key, {}).get(quote.selection)
        if current is None or (
            (quote.captured_at or datetime.min.replace(tzinfo=timezone.utc))
            > (current["captured_at"] or datetime.min.replace(tzinfo=timezone.utc))
        ):
            lines[key][quote.selection] = {
                "odds": quote.odds,
                "captured_at": quote.captured_at,
            }
    if not lines:
        return {}

    def rank(key: Tuple[str, bool]) -> Tuple[int, int, int]:
        bookmaker, is_closing = key
        try:
            book_rank = preference.index(bookmaker)
        except ValueError:
            book_rank = len(preference)
        # Clôture d'abord, puis ordre de préférence, puis ligne la plus fournie.
        return (0 if is_closing else 1, book_rank, -len(lines[key]))

    for key in sorted(lines, key=rank):
        selections = lines[key]
        if len(selections) >= 2:
            return {sel: row["odds"] for sel, row in selections.items()}
    return {}


def _forecast_records(
    db: Session,
    competition_id: Optional[int] = None,
    market_key: str = "1X2",
    min_history: int = 30,
    limit: int = 600,
    devig: str = "proportional",
    bookmaker: Optional[str] = None,
    signal: str = "goals",
) -> Tuple[List[cal.ForecastRecord], dict]:
    """Rejoue l'historique pour confronter le modèle au marché, match par match.

    Pour chaque journée, les forces d'équipe sont recalculées à partir des seuls
    matchs antérieurs : aucune information du futur ne fuit dans la prévision.
    Seuls les matchs disposant des cotes complètes du marché sont évalués.
    """
    query = db.query(SportMatch).filter(
        SportMatch.status == MatchStatus.FINISHED,
        SportMatch.kickoff.isnot(None),
    )
    if competition_id:
        query = query.filter(SportMatch.competition_id == competition_id)
    matches = query.order_by(SportMatch.kickoff).all()

    names = _team_names(db)
    preference = (
        (bookmaker,) + BOOKMAKER_PREFERENCE if bookmaker else BOOKMAKER_PREFERENCE
    )
    by_competition: Dict[int, List[SportMatch]] = {}
    for match in matches:
        by_competition.setdefault(match.competition_id, []).append(match)

    records: List[cal.ForecastRecord] = []
    stats = {
        "matches": len(matches), "evaluated": 0, "without_odds": 0,
        "voided": 0, "demo_data": False,
    }

    for comp_id, comp_matches in by_competition.items():
        played: List[an.MatchRecord] = []
        pending_day: List[SportMatch] = []
        current_day = None
        strengths = baseline = None

        def flush_day():
            """Évalue les matchs d'une même journée avec les forces d'avant-match."""
            nonlocal strengths, baseline
            extras: Dict[str, float] = {}
            for match in pending_day:
                quotes = _market_quotes(match, market_key, preference)
                if len(quotes) < 2:
                    stats["without_odds"] += 1
                    continue
                # Sélection réellement gagnante, déduite du score.
                winner = None
                voided = False
                for selection in quotes:
                    verdict = an.settle_selection(
                        market_key, selection, match.home_goals, match.away_goals
                    )
                    if verdict == "VOID":
                        voided = True
                    elif verdict == "WON":
                        winner = selection
                if voided or winner is None:
                    stats["voided"] += 1
                    continue

                lam_h, lam_a = an.expected_goals(
                    strengths.get(match.home_team_id),
                    strengths.get(match.away_team_id),
                    baseline,
                )
                extras["expected_home"] = lam_h
                extras["expected_away"] = lam_a
                model_markets = an.market_probabilities(
                    an.score_grid(lam_h, lam_a),
                    handicap_lines=an.handicap_lines_from_quotes(
                        [{"market": market_key}]
                    ),
                )
                model = model_markets.get(market_key)
                if not model or any(sel not in model for sel in quotes):
                    stats["without_odds"] += 1
                    continue

                selections = list(quotes)
                model_probs = {sel: model[sel] for sel in selections}
                total = sum(model_probs.values())
                if total <= 0:
                    continue
                model_probs = {sel: p / total for sel, p in model_probs.items()}
                # Dévigorisation neutre par défaut : une méthode plus élaborée
                # déplacerait la barre à franchir, donc fausserait la comparaison.
                market_probs = an.remove_margin(quotes, devig)

                records.append(cal.ForecastRecord(
                    market_key=market_key,
                    model=model_probs,
                    market=market_probs,
                    winner=winner,
                    odds=dict(quotes),
                    kickoff=match.kickoff,
                    label=(
                        f"{names.get(match.home_team_id)} — {names.get(match.away_team_id)}"
                    ),
                    competition=match.competition_id,
                    expected_total=round(
                        extras.get("expected_home", 0) + extras.get("expected_away", 0), 3
                    ),
                ))
                stats["evaluated"] += 1
                if match.competition and match.competition.name == DEMO_COMPETITION_NAME:
                    stats["demo_data"] = True

        for match in comp_matches:
            day = match.kickoff.date() if match.kickoff else None
            if day != current_day:
                if pending_day and len(played) >= min_history:
                    strengths, baseline = an.team_strengths(
                        played, reference=pending_day[0].kickoff, signal=signal
                    )
                    flush_day()
                for done in pending_day:
                    played.append(_match_record(done))
                pending_day = []
                current_day = day
            pending_day.append(match)
            if len(records) >= limit:
                break

        if pending_day and len(played) >= min_history and len(records) < limit:
            strengths, baseline = an.team_strengths(
                played, reference=pending_day[0].kickoff, signal=signal
            )
            flush_day()

    return records, stats


def _settled_returns(db: Session) -> Tuple[List[float], List[float], List[an.BetRecord]]:
    """Rendements unitaires et CLV des paris réglés, pour les tests statistiques."""
    bets = [_bet_record(b) for b in db.query(SportBet).all()]
    returns = [
        b.net_profit() / b.stake
        for b in bets
        if b.is_resolved_stake() and b.stake > 0
    ]
    clv = [
        (b.closing_odds / b.odds - 1.0)
        for b in bets
        if b.is_settled() and b.closing_odds and b.odds and b.odds > 1.0
    ]
    return returns, clv, bets


def _realism_block(db: Session, quick: bool = True) -> dict:
    """Ce que les données prouvent réellement — utilisé par le tableau de bord."""
    # Le balayage n'a de sens que si des matchs joués portent des cotes ; sans
    # cela, inutile de recalculer les forces d'équipe journée par journée.
    has_history_odds = (
        db.query(OddsQuote.id)
        .join(SportMatch, OddsQuote.match_id == SportMatch.id)
        .filter(SportMatch.status == MatchStatus.FINISHED)
        .first()
        is not None
    )
    if has_history_odds:
        records, stats = _forecast_records(db, min_history=30, limit=400 if quick else 1000)
    else:
        records, stats = [], {
            "matches": 0, "evaluated": 0, "without_odds": 0,
            "voided": 0, "demo_data": False,
        }
    calibration = cal.calibration_report(records)
    returns, clv, _ = _settled_returns(db)
    yield_test = cal.significance_test(returns)
    clv_test = cal.clv_summary(clv)
    summary = cal.realism_summary(calibration, yield_test, clv_test)
    return {
        "calibration": {
            k: v for k, v in calibration.items()
            if k not in ("reliability_model", "reliability_market")
        },
        "coverage": stats,
        "demo_caveat": DEMO_CAVEAT if stats.get("demo_data") else None,
        "yield_test": yield_test,
        "clv": clv_test,
        "summary": summary,
    }


@router.get("/calibration")
def calibration(
    competition_id: Optional[int] = None,
    market: str = Query("1X2", description="Marché évalué (1X2, OU_2.5, BTTS…)"),
    min_history: int = Query(30, ge=10, le=500),
    limit: int = Query(600, ge=50, le=2000),
    devig: str = Query("proportional", pattern="^(proportional|odds_ratio|power)$"),
    bookmaker: Optional[str] = Query(
        None, description="Bookmaker de référence (défaut : Pinnacle, puis moyenne du marché)"),
    db: Session = Depends(get_db),
):
    """Confronte le modèle à la cote de clôture, prévision par prévision.

    C'est le test décisif de l'outil : si le modèle ne bat pas le marché sur un
    échantillon suffisant, aucun « edge » qu'il affiche n'est exploitable, et
    l'application doit le dire plutôt que de proposer des mises.
    """
    market_key = market.strip().upper()
    records, stats = _forecast_records(
        db, competition_id=competition_id, market_key=market_key,
        min_history=min_history, limit=limit, devig=devig, bookmaker=bookmaker,
    )
    report = cal.calibration_report(records)

    # Marchés disponibles, pour orienter l'utilisateur vers ceux qui ont des cotes.
    available: Dict[str, int] = {}
    quote_query = db.query(OddsQuote)
    if competition_id:
        quote_query = (
            quote_query.join(SportMatch)
            .filter(SportMatch.competition_id == competition_id)
        )
    for quote in quote_query.all():
        available[quote.market] = available.get(quote.market, 0) + 1

    returns, clv, _ = _settled_returns(db)
    yield_test = cal.significance_test(returns)
    clv_test = cal.clv_summary(clv)

    average_odds = (
        sum(sum(r.odds.values()) / len(r.odds) for r in records) / len(records)
        if records else 2.0
    )

    return {
        "market": market_key,
        "coverage": stats,
        "available_markets": [
            {"market": k, "quotes": v} for k, v in sorted(available.items())
        ],
        "report": report,
        "yield_test": yield_test,
        "clv": clv_test,
        "summary": cal.realism_summary(report, yield_test, clv_test),
        "sample_size_required": {
            "edge_2pct": cal.required_sample_size(0.02, average_odds),
            "edge_5pct": cal.required_sample_size(0.05, average_odds),
            "edge_10pct": cal.required_sample_size(0.10, average_odds),
            "reference_odds": round(average_odds, 2),
        },
        "devig": devig,
        "bookmaker": bookmaker or BOOKMAKER_PREFERENCE[0],
        "note": (
            "Chaque prévision n'utilise que les matchs joués avant le coup d'envoi, "
            "et la cote retenue est celle de clôture quand elle a été saisie. "
            "Le score de Brier du marché est la barre à franchir : la battre est "
            "rare, et c'est précisément ce qui distingue un avantage d'une illusion."
        ),
        "demo_caveat": DEMO_CAVEAT if stats.get("demo_data") else None,
    }


@router.get("/model-comparison")
def model_comparison(
    competition_id: Optional[int] = None,
    market: str = Query("1X2"),
    min_history: int = Query(30, ge=10, le=500),
    limit: int = Query(600, ge=50, le=2000),
    variants: str = Query(
        "goals,shots,blend",
        description="Variantes de signal à comparer, séparées par des virgules"),
    db: Session = Depends(get_db),
):
    """Banc d'essai : quelle façon de mesurer la force d'une équipe prédit le mieux ?

    Chaque variante est rejouée sur exactement le même historique et confrontée
    à la même cote de clôture. Les buts sont l'issue qui compte mais un
    indicateur bruité ; les tirs sont bien plus nombreux, donc plus stables.
    Lequel gagne n'est pas une affaire d'opinion : c'est ce que cet endpoint
    mesure, sur vos données.
    """
    market_key = market.strip().upper()
    wanted = [v.strip().lower() for v in variants.split(",") if v.strip()]
    unknown = [v for v in wanted if v not in an.SIGNAL_VARIANTS]
    if unknown:
        raise HTTPException(
            400,
            f"Variante(s) inconnue(s) : {', '.join(unknown)}. "
            f"Disponibles : {', '.join(an.SIGNAL_VARIANTS)}",
        )

    history = _history(db, competition_id)
    rows: List[dict] = []
    reference_brier: Optional[float] = None

    for variant in wanted:
        records, stats = _forecast_records(
            db, competition_id=competition_id, market_key=market_key,
            min_history=min_history, limit=limit, signal=variant,
        )
        if not records:
            rows.append({
                "variant": variant, "sample": 0,
                "coverage": round(an.signal_coverage(history, variant), 3),
                "note": "aucune prévision cotée à évaluer",
            })
            continue
        report = cal.calibration_report(records)
        reference_brier = report["brier_market"]
        rows.append({
            "variant": variant,
            "sample": report["sample"],
            "coverage": round(an.signal_coverage(history, variant), 3),
            "brier": report["brier_model"],
            "log_loss": report["log_loss_model"],
            "skill_score": report["brier_skill_score"],
            "skill_pct": round((report["brier_skill_score"] or 0) * 100, 2),
            "optimal_market_weight": report["optimal_market_weight"],
            "beats_market": report["beats_market"],
            "verdict": report["verdict"],
        })

    scored = [r for r in rows if r.get("brier") is not None]
    scored.sort(key=lambda r: r["brier"])
    best = scored[0] if scored else None
    baseline_row = next((r for r in rows if r["variant"] == "goals"), None)

    if not scored:
        message = (
            "Aucune prévision cotée : importez des saisons avec leurs cotes de "
            "clôture pour que le banc puisse trancher."
        )
    elif best["beats_market"]:
        message = (
            f"La variante « {best['variant']} » devance la cote de clôture de "
            f"{best['skill_pct']:+.2f} % sur {best['sample']} prévisions. C'est le "
            "seul cas où s'écarter du marché se défend — et encore, à confirmer "
            "sur des données que le réglage n'a pas vues."
        )
    else:
        improvement = (
            best["brier"] - baseline_row["brier"]
            if baseline_row and baseline_row.get("brier") is not None else None
        )
        detail = ""
        if improvement is not None and best["variant"] != "goals":
            detail = (
                f" Elle améliore tout de même le score de Brier de "
                f"{abs(improvement):.5f} par rapport aux buts seuls."
                if improvement < 0 else
                " Aucune variante ne fait mieux que les buts seuls."
            )
        message = (
            f"La meilleure variante est « {best['variant']} », mais aucune ne bat "
            f"la cote de clôture (skill {best['skill_pct']:+.2f} %).{detail} "
            "Le marché reste la meilleure estimation disponible."
        )

    return {
        "market": market_key,
        "reference": {
            "source": "cote de clôture dévigorisée",
            "brier": reference_brier,
        },
        "variants": rows,
        "ranking": [r["variant"] for r in scored],
        "best": best["variant"] if best else None,
        "message": message,
        "note": (
            "Les buts sont l'issue qui compte, mais un tir cadré est une "
            "observation cinq à dix fois plus fréquente : sur une demi-saison, "
            "les tirs disent souvent mieux que les buts ce qu'une équipe vaut. "
            "Encore faut-il que le fichier importé les contienne — voir la "
            "couverture de chaque variante."
        ),
    }


@router.get("/edge-map")
def edge_map(
    competition_id: Optional[int] = None,
    market: Optional[str] = Query(
        None, description="Limiter à un marché ; sinon tous ceux qui ont des cotes"),
    signal: str = Query("goals"),
    min_history: int = Query(30, ge=10, le=500),
    limit: int = Query(1200, ge=50, le=4000),
    db: Session = Depends(get_db),
):
    """Où se situe l'avantage, s'il en existe un ?

    Un avantage moyen nul peut cacher une poche réelle — et, plus souvent,
    une poche gagnante n'est qu'un artefact du découpage. L'endpoint mesure
    chaque segment, exige un effectif minimal, teste la significativité et
    rappelle combien de comparaisons ont été faites.
    """
    if signal.lower() not in an.SIGNAL_VARIANTS:
        raise HTTPException(400, f"Variante inconnue : {signal}")

    markets = [market.strip().upper()] if market else None
    if markets is None:
        query = db.query(OddsQuote.market).distinct()
        if competition_id:
            query = (
                query.join(SportMatch, OddsQuote.match_id == SportMatch.id)
                .filter(SportMatch.competition_id == competition_id)
            )
        markets = sorted({row[0] for row in query.all()})
        # Les marchés que le modèle sait coter d'office ; le reste demanderait
        # une ligne de handicap par match et n'a pas de sens en agrégat.
        markets = [m for m in markets if m == "1X2" or m.startswith("OU_") or m == "BTTS"]

    competitions = {c.id: c.name for c in db.query(Competition).all()}
    all_records: List[cal.ForecastRecord] = []
    coverage = {"markets": markets, "evaluated": 0, "demo_data": False}

    for market_key in markets:
        records, stats = _forecast_records(
            db, competition_id=competition_id, market_key=market_key,
            min_history=min_history, limit=limit, signal=signal,
        )
        all_records.extend(records)
        coverage["evaluated"] += stats["evaluated"]
        coverage["demo_data"] = coverage["demo_data"] or stats.get("demo_data", False)

    result = cal.edge_map(all_records, competitions)
    result["coverage"] = coverage
    result["signal"] = signal
    result["demo_caveat"] = DEMO_CAVEAT if coverage["demo_data"] else None
    return result


# ═══════════════════════════════════════════════════════════════════════════
#  JOURNAL DE PRÉVISIONS — LA MESURE QUI NE PEUT PAS MENTIR
# ═══════════════════════════════════════════════════════════════════════════

class SnapshotIn(BaseModel):
    """Gel des prévisions du modèle sur les matchs à venir."""
    competition_id: Optional[int] = None
    markets: List[str] = ["1X2", "OU_2.5"]
    signal: str = "goals"
    market_weight: float = 0.0   # 0 = avis du modèle seul, ce qui est l'objet du test
    max_matches: int = 100


@router.post("/forecasts/snapshot", status_code=201)
def snapshot_forecasts(payload: SnapshotIn, db: Session = Depends(get_db)):
    """Fige les prévisions du modèle sur les matchs encore à jouer.

    La calibration rejoue l'histoire, mais les réglages du modèle ont été
    choisis en connaissant ces données : son verdict est donc partiellement
    acquis d'avance. Une prévision gelée avant le coup d'envoi, elle, ne peut
    pas être ajustée après coup — c'est la seule preuve qui vaille.

    L'appel est rejouable : une prévision déjà enregistrée n'est jamais
    réécrite, même si le modèle a changé d'avis entre-temps.
    """
    if payload.signal.lower() not in an.SIGNAL_VARIANTS:
        raise HTTPException(400, f"Variante inconnue : {payload.signal}")

    now = datetime.now(timezone.utc)
    query = db.query(SportMatch).filter(SportMatch.status == MatchStatus.SCHEDULED)
    if payload.competition_id:
        query = query.filter(SportMatch.competition_id == payload.competition_id)
    matches = query.order_by(SportMatch.kickoff).limit(payload.max_matches).all()

    existing = {
        (row.match_id, row.market, row.selection)
        for row in db.query(
            SportForecast.match_id, SportForecast.market, SportForecast.selection
        ).all()
    }

    history_cache: Dict[int, List[an.MatchRecord]] = {}
    created = 0
    skipped_no_odds = skipped_started = skipped_existing = 0
    covered_matches = set()

    for match in matches:
        kickoff = match.kickoff
        if kickoff is not None:
            if kickoff.tzinfo is None:
                kickoff = kickoff.replace(tzinfo=timezone.utc)
            if kickoff <= now:
                # Un match déjà commencé ne peut plus fonder une prévision honnête.
                skipped_started += 1
                continue

        quotes = _quotes_payload(match)
        if not quotes:
            skipped_no_odds += 1
            continue

        if match.competition_id not in history_cache:
            history_cache[match.competition_id] = _history(db, match.competition_id)
        history = history_cache[match.competition_id]

        strengths, baseline = an.team_strengths(
            history, reference=kickoff, signal=payload.signal
        )
        lam_h, lam_a = an.expected_goals(
            strengths.get(match.home_team_id), strengths.get(match.away_team_id),
            baseline, match.home_boost or 1.0, match.away_boost or 1.0,
        )
        markets = an.market_probabilities(
            an.score_grid(lam_h, lam_a),
            handicap_lines=an.handicap_lines_from_quotes(quotes),
        )
        value = an.find_value_bets(
            markets, quotes, market_weight=payload.market_weight, edge_haircut=0.0
        )
        by_selection = {(v["market"], v["selection"]): v for v in value}

        for market_key in payload.markets:
            market_key = market_key.strip().upper()
            model = markets.get(market_key)
            if not model:
                continue
            reference_line = _market_quotes(match, market_key)
            for selection, probability in model.items():
                if selection == "PUSH":
                    continue
                key = (match.id, market_key, selection)
                if key in existing:
                    skipped_existing += 1
                    continue
                quote = by_selection.get((market_key, selection))
                db.add(SportForecast(
                    match_id=match.id,
                    market=market_key,
                    selection=selection,
                    model_probability=round(probability, 6),
                    market_probability=(
                        quote["market_probability"] if quote else None
                    ),
                    best_odds=quote["odds"] if quote else None,
                    reference_odds=reference_line.get(selection),
                    signal=payload.signal,
                    market_weight=payload.market_weight,
                    kickoff=match.kickoff,
                ))
                existing.add(key)
                created += 1
                covered_matches.add(match.id)

    db.commit()
    return {
        "created": created,
        "matches_covered": len(covered_matches),
        "skipped": {
            "already_frozen": skipped_existing,
            "no_odds": skipped_no_odds,
            "already_started": skipped_started,
        },
        "signal": payload.signal,
        "markets": payload.markets,
        "note": (
            "Ces prévisions sont désormais figées. Elles seront notées "
            "automatiquement à la saisie des scores, et le tableau de bord du "
            "journal dira, sans complaisance possible, si le modèle bat le marché."
        ),
    }


def _resolve_forecasts(db: Session, match: SportMatch, home_goals: int, away_goals: int) -> int:
    """Note les prévisions gelées d'un match dont le score vient d'être saisi."""
    resolved = 0
    forecasts = db.query(SportForecast).filter(
        SportForecast.match_id == match.id, SportForecast.outcome.is_(None)
    ).all()
    closing = {
        market: _market_quotes(match, market)
        for market in {f.market for f in forecasts}
    }
    for forecast in forecasts:
        verdict = an.settle_selection(
            forecast.market, forecast.selection, home_goals, away_goals
        )
        if verdict is None:
            continue
        # HALF_WON / HALF_LOST n'ont pas de sens pour une prévision probabiliste :
        # on ne note que ce qui est franchement arrivé ou non.
        forecast.outcome = (
            "WON" if verdict in ("WON", "HALF_WON")
            else "LOST" if verdict in ("LOST", "HALF_LOST")
            else "VOID"
        )
        forecast.closing_odds = closing.get(forecast.market, {}).get(forecast.selection)
        forecast.resolved_at = datetime.now(timezone.utc)
        resolved += 1
    return resolved


def _forecast_scoreboard_records(
    rows: Sequence[SportForecast],
    names: Dict[int, str],
) -> List[cal.ForecastRecord]:
    """Regroupe les lignes du journal en prévisions complètes et notées."""
    grouped: Dict[Tuple[int, str], List[SportForecast]] = {}
    for row in rows:
        if row.outcome is None:
            continue
        grouped.setdefault((row.match_id, row.market), []).append(row)

    records: List[cal.ForecastRecord] = []
    for (match_id, market), group in grouped.items():
        winners = [row for row in group if row.outcome == "WON"]
        if len(winners) != 1 or any(row.outcome == "VOID" for row in group):
            # Marché remboursé ou incomplet : inexploitable pour un score.
            continue
        model = {row.selection: row.model_probability for row in group}
        total = sum(model.values())
        if total <= 0:
            continue
        model = {k: v / total for k, v in model.items()}

        market_probs = {
            row.selection: row.market_probability for row in group
            if row.market_probability is not None
        }
        if len(market_probs) != len(group):
            continue
        market_total = sum(market_probs.values())
        if market_total <= 0:
            continue
        market_probs = {k: v / market_total for k, v in market_probs.items()}

        first = group[0]
        records.append(cal.ForecastRecord(
            market_key=market,
            model=model,
            market=market_probs,
            winner=winners[0].selection,
            odds={row.selection: row.best_odds for row in group if row.best_odds},
            kickoff=first.kickoff,
            competition=first.match.competition_id if first.match else None,
            label=(
                f"{names.get(first.match.home_team_id)} — "
                f"{names.get(first.match.away_team_id)}"
                if first.match else ""
            ),
        ))
    return records


@router.get("/forecasts")
def list_forecasts(
    competition_id: Optional[int] = None,
    market: Optional[str] = None,
    pending_only: bool = False,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Contenu du journal, de la prévision la plus récente à la plus ancienne."""
    query = db.query(SportForecast)
    if market:
        query = query.filter(SportForecast.market == market.strip().upper())
    if pending_only:
        query = query.filter(SportForecast.outcome.is_(None))
    if competition_id:
        query = query.join(SportMatch).filter(
            SportMatch.competition_id == competition_id
        )
    rows = query.order_by(desc(SportForecast.kickoff), desc(SportForecast.id)).limit(limit).all()
    names = _team_names(db)
    return [
        {
            "id": row.id,
            "match_id": row.match_id,
            "match": (
                f"{names.get(row.match.home_team_id)} — {names.get(row.match.away_team_id)}"
                if row.match else None
            ),
            "kickoff": row.kickoff.isoformat() if row.kickoff else None,
            "market": row.market,
            "selection": row.selection,
            "model_probability": row.model_probability,
            "market_probability": row.market_probability,
            "best_odds": row.best_odds,
            "reference_odds": row.reference_odds,
            "closing_odds": row.closing_odds,
            "signal": row.signal,
            "outcome": row.outcome,
            "frozen_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/forecasts/scoreboard")
def forecast_scoreboard(
    competition_id: Optional[int] = None,
    market: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Bilan du journal : le modèle bat-il le marché **en conditions réelles** ?

    Contrairement à la calibration, aucune de ces prévisions n'a pu bénéficier
    d'un réglage choisi après coup. Le verdict est donc plus lent à venir — il
    faut attendre que les matchs se jouent — mais il ne souffre aucune objection.
    """
    query = db.query(SportForecast)
    if market:
        query = query.filter(SportForecast.market == market.strip().upper())
    if competition_id:
        query = query.join(SportMatch).filter(
            SportMatch.competition_id == competition_id
        )
    rows = query.all()
    names = _team_names(db)
    records = _forecast_scoreboard_records(rows, names)
    report = cal.calibration_report(records)

    pending = [row for row in rows if row.outcome is None]
    resolved = [row for row in rows if row.outcome is not None]
    clv_values = [
        (row.closing_odds / row.best_odds - 1.0)
        for row in resolved
        if row.closing_odds and row.best_odds and row.best_odds > 1.0
    ]

    campaigns: Dict[str, int] = {}
    for row in rows:
        campaigns[row.signal or "goals"] = campaigns.get(row.signal or "goals", 0) + 1

    return {
        "frozen_total": len(rows),
        "resolved": len(resolved),
        "pending": len(pending),
        "scored_matches": report["sample"],
        "report": {
            k: v for k, v in report.items()
            if k not in ("reliability_market",)
        },
        "clv": cal.clv_summary(clv_values),
        "by_signal": [
            {"signal": signal, "forecasts": count}
            for signal, count in sorted(campaigns.items())
        ],
        "next_kickoffs": [
            {
                "match": (
                    f"{names.get(row.match.home_team_id)} — "
                    f"{names.get(row.match.away_team_id)}" if row.match else None
                ),
                "kickoff": row.kickoff.isoformat() if row.kickoff else None,
                "market": row.market,
            }
            for row in sorted(
                {row.match_id: row for row in pending}.values(),
                key=lambda r: r.kickoff or datetime.max.replace(tzinfo=timezone.utc),
            )[:10]
        ],
        "note": (
            "Le journal ne se remplit qu'avec le temps : chaque prévision doit "
            "attendre que le match se joue. C'est le prix d'une mesure que rien "
            "ne permet d'embellir après coup."
        ),
    }


@router.delete("/forecasts/{forecast_id}")
def delete_forecast(forecast_id: int, db: Session = Depends(get_db)):
    """Retire une prévision du journal.

    Volontairement possible — il faut pouvoir corriger une campagne lancée par
    erreur — mais à manier avec précaution : supprimer les prévisions ratées
    reviendrait à se mentir, ce que tout le reste du module cherche à empêcher.
    """
    forecast = db.get(SportForecast, forecast_id)
    if not forecast:
        raise HTTPException(404, "Prévision introuvable")
    db.delete(forecast)
    db.commit()
    return {
        "deleted": True,
        "warning": (
            "Une prévision supprimée après le match fausse le bilan du journal."
        ),
    }


@router.get("/risk-simulation")
def risk_simulation(
    n_bets: int = Query(500, ge=10, le=5000),
    odds: float = Query(2.0, gt=1.0, le=20.0),
    true_edge: float = Query(0.02, ge=-0.20, le=0.30,
                             description="Avantage réellement détenu — détermine les résultats"),
    believed_edge: Optional[float] = Query(
        None, ge=-0.20, le=0.50,
        description="Avantage supposé — dimensionne les mises (défaut : identique au réel)"),
    bankroll: Optional[float] = None,
    staking: str = Query("kelly", pattern="^(kelly|flat)$"),
    kelly_fraction: float = Query(0.25, gt=0, le=1),
    flat_stake_pct: float = Query(0.01, gt=0, le=0.2),
    n_paths: int = Query(2000, ge=200, le=10000),
    db: Session = Depends(get_db),
):
    """Simule des milliers de trajectoires de la même stratégie.

    Une seule saison ne prouve rien : c'est la dispersion des résultats
    possibles qui dit à quoi s'attendre, et combien de capital il faut pour
    encaisser les mauvais scénarios.
    """
    if bankroll is None:
        bankroll = _current_bankroll(db)["balance"] or 1000.0
    return cal.simulate_strategy(
        n_bets=n_bets, odds=odds, true_edge=true_edge, believed_edge=believed_edge,
        bankroll=max(1.0, bankroll), staking=staking,
        kelly_fraction=kelly_fraction, flat_stake_pct=flat_stake_pct,
        n_paths=n_paths,
    )


# ═══════════════════════════════════════════════════════════════════════════
#  ANALYSE
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/matches/{match_id}/analysis")
def match_analysis(
    match_id: int,
    bankroll: Optional[float] = None,
    min_edge: float = Query(DEFAULT_MIN_EDGE, ge=0, le=0.5),
    kelly_fraction: float = Query(0.25, gt=0, le=1),
    market_weight: float = Query(0.35, ge=0, le=1,
                                 description="Poids du marché dans la probabilité retenue"),
    edge_haircut: float = Query(an.DEFAULT_EDGE_HAIRCUT, ge=0, le=0.2,
                                description="Décote appliquée aux edges estimés"),
    half_life_days: float = Query(an.DEFAULT_HALF_LIFE_DAYS, gt=0),
    form_window: int = Query(10, ge=1, le=50),
    exclude_future: bool = Query(
        True, description="Pour un match passé : n'utiliser que l'historique antérieur"),
    db: Session = Depends(get_db),
):
    """Analyse complète d'un match : le cœur de l'application."""
    match = _get_match(db, match_id)
    before = match.kickoff if (exclude_future and match.kickoff) else None
    history = _history(db, match.competition_id, before=before)
    names = _team_names(db, match.competition_id)

    if bankroll is None:
        bankroll = _current_bankroll(db)["available"]

    result = an.analyse_match(
        history,
        match.home_team_id,
        match.away_team_id,
        quotes=_quotes_payload(match),
        bankroll=max(0.0, bankroll or 0.0),
        reference=match.kickoff,
        half_life_days=half_life_days,
        min_edge=min_edge,
        kelly_fraction=kelly_fraction,
        market_weight=market_weight,
        edge_haircut=edge_haircut,
        home_boost=match.home_boost or 1.0,
        away_boost=match.away_boost or 1.0,
        form_window=form_window,
    )

    # Remplace les identifiants par les noms pour un affichage direct.
    result["teams"] = {
        "home": {"id": match.home_team_id, "name": names.get(match.home_team_id)},
        "away": {"id": match.away_team_id, "name": names.get(match.away_team_id)},
    }
    for block in result["form"].values():
        for row in block.get("last_results", []):
            row["opponent"] = names.get(row["opponent"], row["opponent"])
    for row in result["head_to_head"].get("matches", []):
        row["home"] = names.get(row["home"], row["home"])
        row["away"] = names.get(row["away"], row["away"])
    result["match"] = _match_out(match, names)
    result["bankroll"] = round(bankroll or 0.0, 2)
    return result


@router.post("/predict")
def predict(payload: PredictIn, db: Session = Depends(get_db)):
    """Analyse à la demande, sans créer le match : idéal pour tester une
    affiche hypothétique ou une cote vue chez un bookmaker."""
    comp = None
    if payload.competition_id:
        comp = _get_competition(db, payload.competition_id)

    def find_team(team_id: Optional[int], name: Optional[str]) -> SportTeam:
        if team_id:
            team = db.get(SportTeam, team_id)
            if not team:
                raise HTTPException(404, f"Équipe {team_id} introuvable")
            return team
        if not name:
            raise HTTPException(400, "Équipe non identifiée (id ou nom requis)")
        q = db.query(SportTeam).filter(SportTeam.name == name.strip())
        if comp:
            q = q.filter(SportTeam.competition_id == comp.id)
        team = q.first()
        if not team:
            raise HTTPException(404, f"Équipe « {name} » introuvable")
        return team

    home = find_team(payload.home_team_id, payload.home_team)
    away = find_team(payload.away_team_id, payload.away_team)
    competition_id = comp.id if comp else home.competition_id
    history = _history(db, competition_id)
    names = _team_names(db, competition_id)

    bankroll = payload.bankroll
    if bankroll is None:
        bankroll = _current_bankroll(db)["available"]

    result = an.analyse_match(
        history, home.id, away.id,
        quotes=[q.model_dump() for q in payload.quotes],
        bankroll=max(0.0, bankroll or 0.0),
        half_life_days=payload.half_life_days,
        min_edge=payload.min_edge,
        kelly_fraction=payload.kelly_fraction,
        market_weight=payload.market_weight,
        edge_haircut=payload.edge_haircut,
        home_boost=payload.home_boost,
        away_boost=payload.away_boost,
    )
    result["teams"] = {
        "home": {"id": home.id, "name": home.name},
        "away": {"id": away.id, "name": away.name},
    }
    for block in result["form"].values():
        for row in block.get("last_results", []):
            row["opponent"] = names.get(row["opponent"], row["opponent"])
    for row in result["head_to_head"].get("matches", []):
        row["home"] = names.get(row["home"], row["home"])
        row["away"] = names.get(row["away"], row["away"])
    return result


def _scan_value_bets(
    db: Session,
    competition_id: Optional[int] = None,
    min_edge: float = DEFAULT_MIN_EDGE,
    kelly_fraction: float = 0.25,
    market_weight: float = 0.35,
    edge_haircut: float = an.DEFAULT_EDGE_HAIRCUT,
    limit: int = 30,
    only_proven: bool = False,
    signal: str = "goals",
) -> dict:
    """Balaye les matchs à venir disposant de cotes et remonte les sélections
    dont l'edge dépasse le seuil, triées par valeur décroissante.

    Fonction Python ordinaire (et non endpoint) afin d'être réutilisable par le
    tableau de bord sans passer par le mécanisme d'injection de FastAPI.
    """
    q = db.query(SportMatch).filter(SportMatch.status == MatchStatus.SCHEDULED)
    if competition_id:
        q = q.filter(SportMatch.competition_id == competition_id)
    matches = q.order_by(SportMatch.kickoff).all()

    bankroll = _current_bankroll(db)["available"]
    names = _team_names(db)
    history_cache: Dict[int, List[an.MatchRecord]] = {}
    opportunities: List[dict] = []

    # Filtrage par poche démontrée : on ne garde que les couples
    # (compétition, marché) où la carte des avantages établit que le modèle bat
    # réellement la cote de clôture. C'est le seul usage défendable du scan.
    proven_markets: Optional[set] = None
    proven_competitions: Optional[set] = None
    proven_summary: Optional[dict] = None
    if only_proven:
        competitions = {c.id: c.name for c in db.query(Competition).all()}
        pocket_records: List[cal.ForecastRecord] = []
        for pocket_market in ("1X2", "OU_2.5", "BTTS"):
            found, _ = _forecast_records(
                db, competition_id=competition_id, market_key=pocket_market,
                min_history=30, limit=1200, signal=signal,
            )
            pocket_records.extend(found)
        pockets = cal.edge_map(pocket_records, competitions)
        proven_markets = {
            row["segment"] for row in pockets["segments"]["par_marche"]
            if row["beats_market"]
        }
        proven_competitions = {
            row["segment"] for row in pockets["segments"]["par_competition"]
            if row["beats_market"]
        }
        proven_summary = {
            "markets": sorted(proven_markets),
            "competitions": sorted(proven_competitions),
            "sample": pockets["sample"],
            "message": pockets["message"],
        }

    for match in matches:
        quotes = _quotes_payload(match)
        if not quotes:
            continue
        if match.competition_id not in history_cache:
            history_cache[match.competition_id] = _history(db, match.competition_id)
        history = history_cache[match.competition_id]

        strengths, baseline = an.team_strengths(history, reference=match.kickoff)
        lam_h, lam_a = an.expected_goals(
            strengths.get(match.home_team_id), strengths.get(match.away_team_id),
            baseline, match.home_boost or 1.0, match.away_boost or 1.0,
        )
        markets = an.market_probabilities(
            an.score_grid(lam_h, lam_a),
            handicap_lines=an.handicap_lines_from_quotes(quotes),
        )
        confidence = an.sample_confidence(
            len(an.team_matches(history, match.home_team_id)),
            len(an.team_matches(history, match.away_team_id)),
        )
        found = an.find_value_bets(
            markets, quotes, bankroll=bankroll, min_edge=min_edge,
            kelly_fraction=kelly_fraction, market_weight=market_weight,
            edge_haircut=edge_haircut,
        )
        for bet in found:
            if not bet["is_value"]:
                continue
            if only_proven:
                competition_name = (
                    match.competition.name if match.competition else None
                )
                if (
                    bet["market"] not in (proven_markets or set())
                    or competition_name not in (proven_competitions or set())
                ):
                    continue
            opportunities.append({
                **bet,
                "match_id": match.id,
                "match": f"{names.get(match.home_team_id)} - {names.get(match.away_team_id)}",
                "kickoff": match.kickoff.isoformat() if match.kickoff else None,
                "competition_id": match.competition_id,
                "confidence": confidence,
                "expected_goals": {"home": round(lam_h, 2), "away": round(lam_a, 2)},
            })

    opportunities.sort(key=lambda o: o["edge"], reverse=True)
    return {
        "bankroll": bankroll,
        "min_edge": min_edge,
        "edge_haircut": edge_haircut,
        "matches_scanned": len(matches),
        "count": len(opportunities),
        "opportunities": opportunities[:limit],
        "only_proven": only_proven,
        "proven_pockets": proven_summary,
        "filter_note": (
            (
                "Filtre actif : seules les poches où le modèle bat réellement la "
                "cote de clôture sont retenues."
                + (
                    " Aucune ne remplit cette condition pour l'instant, d'où une "
                    "liste vide — c'est le résultat attendu tant que rien n'est "
                    "démontré."
                    if not opportunities else ""
                )
            )
            if only_proven else
            "Filtre inactif : ces opportunités reposent sur un modèle dont "
            "l'avantage n'est pas établi. Activez « poches démontrées » pour ne "
            "voir que ce qui est étayé."
        ),
    }


@router.get("/value-bets")
def value_bets(
    competition_id: Optional[int] = None,
    min_edge: float = Query(DEFAULT_MIN_EDGE, ge=0, le=0.5),
    kelly_fraction: float = Query(0.25, gt=0, le=1),
    market_weight: float = Query(0.35, ge=0, le=1),
    edge_haircut: float = Query(an.DEFAULT_EDGE_HAIRCUT, ge=0, le=0.2),
    limit: int = Query(30, ge=1, le=200),
    only_proven: bool = Query(
        False, description="Ne garder que les poches où le modèle bat le marché"),
    signal: str = Query("goals"),
    db: Session = Depends(get_db),
):
    """Toutes les opportunités de valeur détectées sur les matchs à venir."""
    if signal.lower() not in an.SIGNAL_VARIANTS:
        raise HTTPException(400, f"Variante inconnue : {signal}")
    return _scan_value_bets(
        db, competition_id=competition_id, min_edge=min_edge,
        kelly_fraction=kelly_fraction, market_weight=market_weight,
        edge_haircut=edge_haircut, limit=limit, only_proven=only_proven,
        signal=signal,
    )


@router.get("/backtest")
def backtest(
    competition_id: int,
    min_edge: float = Query(DEFAULT_MIN_EDGE, ge=0, le=0.5),
    market_weight: float = Query(0.35, ge=0, le=1),
    edge_haircut: float = Query(an.DEFAULT_EDGE_HAIRCUT, ge=0, le=0.2),
    flat_stake: float = Query(10.0, gt=0),
    min_history: int = Query(40, ge=10, le=500,
                             description="Matchs d'historique avant de commencer à parier"),
    db: Session = Depends(get_db),
):
    """Rejoue la saison en n'utilisant, pour chaque match, que les données
    antérieures à son coup d'envoi.

    Un match n'est simulé que s'il possède des cotes enregistrées. Le résultat
    donne le ROI qu'aurait produit la stratégie à mise fixe — le seul moyen
    honnête de juger le modèle avant de risquer de l'argent.
    """
    _get_competition(db, competition_id)
    matches = (
        db.query(SportMatch)
        .filter(
            SportMatch.competition_id == competition_id,
            SportMatch.status == MatchStatus.FINISHED,
            SportMatch.kickoff.isnot(None),
        )
        .order_by(SportMatch.kickoff)
        .all()
    )
    names = _team_names(db, competition_id)
    played: List[an.MatchRecord] = []
    simulated: List[an.BetRecord] = []
    rows: List[dict] = []
    skipped_no_odds = 0

    for match in matches:
        if len(played) >= min_history:
            quotes = _quotes_payload(match)
            if quotes:
                strengths, baseline = an.team_strengths(played, reference=match.kickoff)
                lam_h, lam_a = an.expected_goals(
                    strengths.get(match.home_team_id),
                    strengths.get(match.away_team_id), baseline,
                )
                markets = an.market_probabilities(
                    an.score_grid(lam_h, lam_a),
                    handicap_lines=an.handicap_lines_from_quotes(quotes),
                )
                for pick in an.find_value_bets(
                    markets, quotes, min_edge=min_edge, market_weight=market_weight,
                    edge_haircut=edge_haircut,
                ):
                    if not pick["is_value"]:
                        continue
                    verdict = an.settle_selection(
                        pick["market"], pick["selection"],
                        match.home_goals, match.away_goals,
                    )
                    if verdict is None:
                        continue
                    record = an.BetRecord(
                        stake=flat_stake, odds=pick["odds"], status=verdict,
                        market=pick["market"], selection=pick["selection"],
                        model_prob=pick["blended_probability"],
                        placed_at=match.kickoff,
                        label=f"{names.get(match.home_team_id)} - {names.get(match.away_team_id)}",
                    )
                    simulated.append(record)
                    rows.append({
                        "match_id": match.id,
                        "kickoff": match.kickoff.isoformat() if match.kickoff else None,
                        "match": record.label,
                        "market": pick["market"],
                        "selection": pick["selection"],
                        "odds": pick["odds"],
                        "edge_pct": pick["edge_pct"],
                        "result": verdict,
                        "profit": round(record.net_profit(), 2),
                        "score": f"{match.home_goals}-{match.away_goals}",
                    })
            else:
                skipped_no_odds += 1
        played.append(_match_record(match))

    performance = an.bet_performance(simulated, starting_bankroll=0.0)
    return {
        "competition_id": competition_id,
        "matches_available": len(matches),
        "matches_without_odds": skipped_no_odds,
        "min_history": min_history,
        "flat_stake": flat_stake,
        "min_edge": min_edge,
        "simulated_bets": len(simulated),
        "performance": performance,
        "bets": rows[-100:],
        "note": (
            "Backtest à mise fixe, sans fuite d'information : chaque prévision "
            "n'utilise que les matchs joués avant le coup d'envoi. Un ROI positif "
            "sur moins de 100 paris reste statistiquement peu significatif."
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  PARIS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/bets")
def list_bets(
    status: Optional[BetStatus] = None,
    match_id: Optional[int] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(SportBet)
    if status:
        q = q.filter(SportBet.status == status)
    if match_id:
        q = q.filter(SportBet.match_id == match_id)
    bets = q.order_by(desc(SportBet.placed_at), desc(SportBet.id)).limit(limit).all()
    names = _team_names(db)
    out = []
    for bet in bets:
        row = _bet_out(bet)
        if bet.match:
            row["match"] = (
                f"{names.get(bet.match.home_team_id)} - {names.get(bet.match.away_team_id)}"
            )
        out.append(row)
    return out


@router.post("/bets", status_code=201)
def create_bet(payload: BetIn, db: Session = Depends(get_db)):
    if payload.match_id:
        _get_match(db, payload.match_id)
    data = payload.model_dump(exclude_unset=True)
    data["market"] = data["market"].strip().upper()
    data["selection"] = data["selection"].strip().upper()
    if data.get("edge") is None and data.get("model_probability"):
        data["edge"] = an.edge(data["model_probability"], data["odds"])
    bet = SportBet(**data)
    db.add(bet)
    db.commit()
    db.refresh(bet)
    return _bet_out(bet)


@router.put("/bets/{bet_id}/settle")
def settle_bet(bet_id: int, payload: SettleIn, db: Session = Depends(get_db)):
    """Règle un pari. Le profit est calculé automatiquement sauf pour un
    cash-out, où le montant réellement encaissé doit être fourni."""
    bet = db.get(SportBet, bet_id)
    if not bet:
        raise HTTPException(404, "Pari introuvable")
    bet.status = payload.status
    if payload.closing_odds:
        bet.closing_odds = payload.closing_odds
    if payload.profit is not None:
        bet.profit = payload.profit
    elif payload.status == BetStatus.CASHOUT:
        raise HTTPException(400, "Un cash-out exige le profit net réellement encaissé")
    else:
        bet.profit = None
        bet.profit = round(_bet_record(bet).net_profit(), 2)
    bet.settled_at = (
        datetime.now(timezone.utc) if payload.status != BetStatus.PENDING else None
    )
    db.commit()
    db.refresh(bet)
    return _bet_out(bet)


@router.delete("/bets/{bet_id}")
def delete_bet(bet_id: int, db: Session = Depends(get_db)):
    bet = db.get(SportBet, bet_id)
    if not bet:
        raise HTTPException(404, "Pari introuvable")
    db.delete(bet)
    db.commit()
    return {"deleted": True}


@router.get("/performance")
def performance(db: Session = Depends(get_db)):
    """Bilan du parieur, assorti de ce que ces chiffres prouvent réellement.

    Le ROI seul est trompeur sur petit échantillon : on l'accompagne donc d'un
    test de significativité, de l'analyse du CLV et du nombre de paris qu'il
    faudrait pour trancher.
    """
    returns, clv, bets = _settled_returns(db)
    bankroll = _current_bankroll(db)
    stats = an.bet_performance(bets, starting_bankroll=bankroll["starting_capital"])

    yield_test = cal.significance_test(returns)
    clv_test = cal.clv_summary(clv)
    reference_odds = stats["avg_odds"] or 2.0
    observed_edge = max(0.01, stats["roi"]) if stats["roi"] > 0 else 0.02

    return {
        "bankroll": bankroll,
        "performance": stats,
        "significance": {
            "yield": yield_test,
            "clv": clv_test,
            "bets_needed_for_observed_edge": cal.required_sample_size(
                observed_edge, reference_odds
            ),
            "bets_needed_for_2pct_edge": cal.required_sample_size(0.02, reference_odds),
            "reference_odds": round(reference_odds, 2),
            "note": (
                "Le nombre de paris nécessaires est calculé pour détecter un "
                "avantage de cette taille à 95 % de confiance. Il dépasse "
                "presque toujours ce qu'un parieur individuel joue en une saison "
                "— d'où l'importance du CLV, qui conclut bien plus vite."
            ),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
#  BANKROLL
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/bankroll")
def bankroll_state(db: Session = Depends(get_db)):
    txs = (
        db.query(BankrollTransaction)
        .order_by(desc(BankrollTransaction.created_at))
        .limit(100)
        .all()
    )
    return {
        **_current_bankroll(db),
        "transactions": [
            {
                "id": t.id,
                "type": t.type.value if hasattr(t.type, "value") else t.type,
                "amount": t.amount, "currency": t.currency, "note": t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ],
    }


@router.post("/bankroll/transactions", status_code=201)
def add_bankroll_tx(payload: BankrollIn, db: Session = Depends(get_db)):
    tx = BankrollTransaction(**payload.model_dump())
    db.add(tx)
    db.commit()
    return {"id": tx.id, **_current_bankroll(db)}


@router.delete("/bankroll/transactions/{tx_id}")
def delete_bankroll_tx(tx_id: int, db: Session = Depends(get_db)):
    tx = db.get(BankrollTransaction, tx_id)
    if not tx:
        raise HTTPException(404, "Mouvement introuvable")
    db.delete(tx)
    db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════════════════════
#  TABLEAU DE BORD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    """Vue d'ensemble : capital, performance, prochains matchs, meilleures
    opportunités de valeur, derniers paris."""
    bankroll = _current_bankroll(db)
    bets = [_bet_record(b) for b in db.query(SportBet).all()]
    perf = an.bet_performance(bets, starting_bankroll=bankroll["starting_capital"])
    names = _team_names(db)

    upcoming = (
        db.query(SportMatch)
        .filter(SportMatch.status == MatchStatus.SCHEDULED)
        .order_by(SportMatch.kickoff)
        .limit(10)
        .all()
    )
    recent_bets = (
        db.query(SportBet)
        .order_by(desc(SportBet.placed_at), desc(SportBet.id))
        .limit(10)
        .all()
    )
    top_value = _scan_value_bets(db, min_edge=DEFAULT_MIN_EDGE, limit=5)
    realism = _realism_block(db)

    return {
        "bankroll": bankroll,
        "realism": realism,
        "performance": {
            k: v for k, v in perf.items() if k not in ("bankroll_curve", "by_market")
        },
        "bankroll_curve": perf["bankroll_curve"],
        "by_market": perf["by_market"],
        "counts": {
            "competitions": db.query(Competition).count(),
            "teams": db.query(SportTeam).count(),
            "matches": db.query(SportMatch).count(),
            "finished": db.query(SportMatch).filter(
                SportMatch.status == MatchStatus.FINISHED).count(),
            "scheduled": db.query(SportMatch).filter(
                SportMatch.status == MatchStatus.SCHEDULED).count(),
        },
        "upcoming_matches": [_match_out(m, names) for m in upcoming],
        "top_value_bets": top_value["opportunities"],
        "recent_bets": [_bet_out(b) for b in recent_bets],
    }


# ═══════════════════════════════════════════════════════════════════════════
#  JEU DE DÉMONSTRATION
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/seed-demo")
def seed_demo(
    matches_per_team: int = Query(22, ge=6, le=60),
    reset: bool = Query(False, description="Supprime d'abord la compétition de démo"),
    db: Session = Depends(get_db),
):
    """Crée une compétition fictive complète (championnat simulé, matchs à
    venir avec cotes, bankroll et quelques paris) pour explorer l'outil
    immédiatement, sans saisie manuelle."""
    import random

    DEMO_NAME = DEMO_COMPETITION_NAME
    existing = db.query(Competition).filter(Competition.name == DEMO_NAME).first()
    if existing and not reset:
        raise HTTPException(
            409, "Le jeu de démonstration existe déjà (utiliser reset=true pour le recréer)"
        )
    if existing:
        db.delete(existing)
        db.commit()

    rng = random.Random(2026)
    comp = Competition(name=DEMO_NAME, season="2026/2027", country="Démo",
                       notes="Données simulées à des fins de démonstration.")
    db.add(comp)
    db.flush()

    club_names = [
        "AS Kolomba", "FC Bandama", "Étoile de Yamoussa", "Racing Abidjan",
        "US Bouaké", "Olympique San Pedro", "AC Korhogo", "FC Daloa",
        "Sporting Man", "Union Divo",
    ]
    quality = {}
    teams = []
    for name in club_names:
        team = SportTeam(name=name, competition_id=comp.id,
                         short_name=name.split()[-1][:3].upper())
        db.add(team)
        teams.append(team)
    db.flush()
    for team in teams:
        quality[team.id] = rng.uniform(0.75, 1.35)

    from datetime import timedelta
    start = datetime.now(timezone.utc) - timedelta(days=matches_per_team * 7)
    ids = [t.id for t in teams]

    def simulate(lam: float) -> int:
        """Tirage Poisson par la méthode de Knuth (pas de dépendance externe)."""
        import math as _math
        limit, k, p = _math.exp(-lam), 0, 1.0
        while True:
            p *= rng.random()
            if p <= limit:
                return k
            k += 1

    played_matches: List[Tuple[SportMatch, float, float]] = []
    for round_index in range(matches_per_team):
        order = ids[:]
        rng.shuffle(order)
        kickoff = start + timedelta(days=round_index * 7)
        for i in range(0, len(order) - 1, 2):
            h, a = order[i], order[i + 1]
            lam_h = 1.45 * quality[h] / quality[a]
            lam_a = 1.10 * quality[a] / quality[h]
            match = SportMatch(
                competition_id=comp.id, home_team_id=h, away_team_id=a,
                kickoff=kickoff, matchday=round_index + 1,
                status=MatchStatus.FINISHED,
                home_goals=simulate(lam_h), away_goals=simulate(lam_a),
                home_xg=round(lam_h + rng.uniform(-0.3, 0.3), 2),
                away_xg=round(lam_a + rng.uniform(-0.3, 0.3), 2),
                # Les tirs suivent la domination réelle, comme dans un vrai match :
                # environ quatre tirs cadrés par but attendu, et trois tirs tentés
                # par tir cadré. Sans cela, la variante « tirs » du banc d'essai
                # n'aurait aucun signal à trouver et serait injustement condamnée.
                home_shots_on_target=simulate(4 * lam_h),
                away_shots_on_target=simulate(4 * lam_a),
                home_shots=simulate(12 * lam_h),
                away_shots=simulate(12 * lam_a),
                home_corners=rng.randint(2, 11), away_corners=rng.randint(1, 9),
            )
            db.add(match)
            played_matches.append((match, lam_h, lam_a))
    db.flush()

    # Cotes de clôture historiques, construites à partir des VRAIS paramètres de
    # la simulation : le marché de démonstration est donc volontairement précis,
    # comme l'est un marché liquide réel. C'est ce qui permet à l'onglet
    # « Réalisme » de montrer honnêtement que le modèle, estimé sur un
    # échantillon fini, ne le bat pas.
    for match, lam_h, lam_a in played_matches:
        true_markets = an.market_probabilities(an.score_grid(lam_h, lam_a))
        for market in ("1X2", "OU_2.5"):
            for selection, probability in true_markets[market].items():
                if selection == "PUSH" or probability <= 0:
                    continue
                # Marge bookmaker d'environ 5 %, plus un léger bruit de cotation.
                shown = an.clamp(probability * 1.05 * rng.uniform(0.98, 1.02), 0.01, 0.97)
                db.add(OddsQuote(
                    match_id=match.id, market=market, selection=selection,
                    odds=round(1 / shown, 2), bookmaker="DemoBook", is_closing=True,
                    captured_at=match.kickoff,
                ))
    db.flush()

    # Matchs à venir + cotes bookmaker (marge ~6 %) légèrement décalées du
    # modèle, de façon à ce que la détection de valeur ait quelque chose à voir.
    history = _history(db, comp.id)
    strengths, baseline = an.team_strengths(history)
    upcoming_ids = []
    for index in range(5):
        h, a = ids[index * 2], ids[index * 2 + 1]
        kickoff = datetime.now(timezone.utc) + timedelta(days=index + 1)
        match = SportMatch(
            competition_id=comp.id, home_team_id=h, away_team_id=a,
            kickoff=kickoff, matchday=matches_per_team + 1,
            status=MatchStatus.SCHEDULED,
        )
        db.add(match)
        db.flush()
        upcoming_ids.append(match.id)

        lam_h, lam_a = an.expected_goals(strengths.get(h), strengths.get(a), baseline)
        markets = an.market_probabilities(an.score_grid(lam_h, lam_a))
        for market in ("1X2", "OU_2.5", "BTTS"):
            probabilities = markets[market]
            for selection, probability in probabilities.items():
                if selection == "PUSH" or probability <= 0:
                    continue
                noise = rng.uniform(-0.10, 0.10)
                shown = an.clamp(probability * (1 + noise) * 1.03, 0.01, 0.97)
                db.add(OddsQuote(
                    match_id=match.id, market=market, selection=selection,
                    odds=round(1 / shown, 2), bookmaker="DemoBook",
                ))

    if db.query(BankrollTransaction).count() == 0:
        db.add(BankrollTransaction(
            type=BankrollTxType.DEPOSIT, amount=1000.0,
            note="Capital initial (démonstration)",
        ))
    db.commit()

    return {
        "competition_id": comp.id,
        "competition": comp.name,
        "teams": len(teams),
        "finished_matches": db.query(SportMatch).filter(
            SportMatch.competition_id == comp.id,
            SportMatch.status == MatchStatus.FINISHED).count(),
        "upcoming_matches": upcoming_ids,
        "message": (
            "Jeu de démonstration créé, cotes de clôture historiques comprises. "
            "Consulter /sport/dashboard, /sport/matches/{id}/analysis, puis "
            "/sport/calibration pour confronter le modèle au marché."
        ),
        "caveat": DEMO_CAVEAT,
    }
