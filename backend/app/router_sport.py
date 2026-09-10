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
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from . import analytics_sport as an
from .database import get_db
from .models_sport import (
    BankrollTransaction, BankrollTxType, BetStatus, Competition, MatchStatus,
    OddsQuote, SportBet, SportMatch, SportTeam,
)

router = APIRouter(prefix="/sport", tags=["sport"])

#: Seuil de valeur en dessous duquel on ne parie pas. 3 % d'edge est un
#: minimum réaliste : en dessous, l'erreur du modèle dépasse l'avantage.
DEFAULT_MIN_EDGE = 0.03


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
    records = []
    for m in q.all():
        if m.home_goals is None or m.away_goals is None:
            continue
        records.append(an.MatchRecord(
            home=m.home_team_id,
            away=m.away_team_id,
            home_goals=m.home_goals,
            away_goals=m.away_goals,
            kickoff=m.kickoff,
            competition=m.competition_id,
            home_xg=m.home_xg,
            away_xg=m.away_xg,
        ))
    return records


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
    return {"match": _match_out(match), "settled_bets": settled}


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

    created = skipped = 0
    errors: List[str] = []
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

    db.commit()
    return {
        "competition_id": comp.id,
        "competition": comp.name,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "teams_total": db.query(SportTeam).filter(SportTeam.competition_id == comp.id).count(),
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
    margins = {
        market: an.overround([row["odds"] for row in rows])
        for market, rows in grouped.items()
    }
    return {
        "match_id": match_id,
        "markets": grouped,
        "margins": {k: (round(v, 4) if v is not None else None) for k, v in margins.items()},
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
    limit: int = 30,
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
        markets = an.market_probabilities(an.score_grid(lam_h, lam_a))
        confidence = an.sample_confidence(
            len(an.team_matches(history, match.home_team_id)),
            len(an.team_matches(history, match.away_team_id)),
        )
        found = an.find_value_bets(
            markets, quotes, bankroll=bankroll, min_edge=min_edge,
            kelly_fraction=kelly_fraction, market_weight=market_weight,
        )
        for bet in found:
            if not bet["is_value"]:
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
        "matches_scanned": len(matches),
        "count": len(opportunities),
        "opportunities": opportunities[:limit],
    }


@router.get("/value-bets")
def value_bets(
    competition_id: Optional[int] = None,
    min_edge: float = Query(DEFAULT_MIN_EDGE, ge=0, le=0.5),
    kelly_fraction: float = Query(0.25, gt=0, le=1),
    market_weight: float = Query(0.35, ge=0, le=1),
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Toutes les opportunités de valeur détectées sur les matchs à venir."""
    return _scan_value_bets(
        db, competition_id=competition_id, min_edge=min_edge,
        kelly_fraction=kelly_fraction, market_weight=market_weight, limit=limit,
    )


@router.get("/backtest")
def backtest(
    competition_id: int,
    min_edge: float = Query(DEFAULT_MIN_EDGE, ge=0, le=0.5),
    market_weight: float = Query(0.35, ge=0, le=1),
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
                markets = an.market_probabilities(an.score_grid(lam_h, lam_a))
                for pick in an.find_value_bets(
                    markets, quotes, min_edge=min_edge, market_weight=market_weight
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
        played.append(an.MatchRecord(
            home=match.home_team_id, away=match.away_team_id,
            home_goals=match.home_goals, away_goals=match.away_goals,
            kickoff=match.kickoff, competition=match.competition_id,
        ))

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
    """Bilan du parieur : ROI, yield, drawdown, CLV, détail par marché."""
    bets = [_bet_record(b) for b in db.query(SportBet).all()]
    bankroll = _current_bankroll(db)
    return {
        "bankroll": bankroll,
        "performance": an.bet_performance(bets, starting_bankroll=bankroll["starting_capital"]),
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

    return {
        "bankroll": bankroll,
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

    DEMO_NAME = "Championnat Démo"
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

    for round_index in range(matches_per_team):
        order = ids[:]
        rng.shuffle(order)
        kickoff = start + timedelta(days=round_index * 7)
        for i in range(0, len(order) - 1, 2):
            h, a = order[i], order[i + 1]
            lam_h = 1.45 * quality[h] / quality[a]
            lam_a = 1.10 * quality[a] / quality[h]
            db.add(SportMatch(
                competition_id=comp.id, home_team_id=h, away_team_id=a,
                kickoff=kickoff, matchday=round_index + 1,
                status=MatchStatus.FINISHED,
                home_goals=simulate(lam_h), away_goals=simulate(lam_a),
                home_xg=round(lam_h + rng.uniform(-0.3, 0.3), 2),
                away_xg=round(lam_a + rng.uniform(-0.3, 0.3), 2),
                home_shots=rng.randint(6, 20), away_shots=rng.randint(4, 17),
                home_corners=rng.randint(2, 11), away_corners=rng.randint(1, 9),
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
            "Jeu de démonstration créé. Consulter /sport/dashboard puis "
            "/sport/matches/{id}/analysis sur un match à venir."
        ),
    }
