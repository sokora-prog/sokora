"""
SOKORA SPORT — Module d'analyse des matchs sportifs (v1)

Modèle de données d'un outil personnel d'analyse et de suivi de paris :

    Competition ──< SportTeam
         └────────< SportMatch >──── OddsQuote (cotes relevées)
                        └────────── SportBet   (paris joués)
    BankrollTransaction  (dépôts / retraits, base du calcul de ROI)

Chaque match stocke à la fois le résultat et les indicateurs de performance
(tirs, corners, xG, cartons) : ce sont eux qui permettent de distinguer une
victoire méritée d'un coup de chance, distinction centrale pour un analyste.
"""

import enum

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SAEnum, Float, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


# ─────────────────────────────────────────────────────────────────────────────
#  ÉNUMÉRATIONS
# ─────────────────────────────────────────────────────────────────────────────

class MatchStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"    # à venir → analysable / pariable
    LIVE      = "LIVE"
    FINISHED  = "FINISHED"     # alimente le modèle statistique
    POSTPONED = "POSTPONED"
    CANCELLED = "CANCELLED"


class BetStatus(str, enum.Enum):
    PENDING   = "PENDING"
    WON       = "WON"
    LOST      = "LOST"
    HALF_WON  = "HALF_WON"     # handicap asiatique en quart de but
    HALF_LOST = "HALF_LOST"
    VOID      = "VOID"         # remboursé (push, match annulé)
    CASHOUT   = "CASHOUT"      # clôturé avant la fin, profit saisi à la main


class BankrollTxType(str, enum.Enum):
    DEPOSIT    = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    ADJUSTMENT = "ADJUSTMENT"  # correction manuelle (bonus, frais…)


# ─────────────────────────────────────────────────────────────────────────────
#  COMPÉTITIONS ET ÉQUIPES
# ─────────────────────────────────────────────────────────────────────────────

class Competition(Base):
    """Championnat ou coupe. Les statistiques sont calculées par compétition :
    mélanger deux championnats de niveaux différents fausse les forces."""
    __tablename__ = "sport_competitions"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    sport      = Column(String(40), default="football", nullable=False)
    country    = Column(String(80), nullable=True)
    season     = Column(String(20), nullable=True)          # ex. "2026/2027"
    is_active  = Column(Boolean, default=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teams   = relationship("SportTeam", back_populates="competition",
                           cascade="all, delete-orphan")
    matches = relationship("SportMatch", back_populates="competition",
                           cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("name", "season", name="uq_sport_competition_season"),
    )


class SportTeam(Base):
    __tablename__ = "sport_teams"

    id             = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("sport_competitions.id"), nullable=True)
    name           = Column(String(120), nullable=False, index=True)
    short_name     = Column(String(20), nullable=True)
    country        = Column(String(80), nullable=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    competition  = relationship("Competition", back_populates="teams")
    home_matches = relationship(
        "SportMatch", foreign_keys="SportMatch.home_team_id",
        back_populates="home_team", cascade="all, delete-orphan",
    )
    away_matches = relationship(
        "SportMatch", foreign_keys="SportMatch.away_team_id",
        back_populates="away_team", cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("competition_id", "name", name="uq_sport_team_per_competition"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  MATCHS
# ─────────────────────────────────────────────────────────────────────────────

class SportMatch(Base):
    __tablename__ = "sport_matches"

    id             = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("sport_competitions.id"), nullable=False)
    home_team_id   = Column(Integer, ForeignKey("sport_teams.id"), nullable=False)
    away_team_id   = Column(Integer, ForeignKey("sport_teams.id"), nullable=False)
    kickoff        = Column(DateTime(timezone=True), nullable=True, index=True)
    matchday       = Column(Integer, nullable=True)
    status         = Column(SAEnum(MatchStatus), default=MatchStatus.SCHEDULED,
                            nullable=False, index=True)

    # Score
    home_goals    = Column(Integer, nullable=True)
    away_goals    = Column(Integer, nullable=True)
    home_ht_goals = Column(Integer, nullable=True)   # mi-temps
    away_ht_goals = Column(Integer, nullable=True)

    # Indicateurs de performance : mesurent la domination réelle
    home_xg               = Column(Float, nullable=True)
    away_xg               = Column(Float, nullable=True)
    home_shots            = Column(Integer, nullable=True)
    away_shots            = Column(Integer, nullable=True)
    home_shots_on_target  = Column(Integer, nullable=True)
    away_shots_on_target  = Column(Integer, nullable=True)
    home_corners          = Column(Integer, nullable=True)
    away_corners          = Column(Integer, nullable=True)
    home_possession       = Column(Float, nullable=True)   # %
    away_possession       = Column(Float, nullable=True)
    home_yellow_cards     = Column(Integer, nullable=True)
    away_yellow_cards     = Column(Integer, nullable=True)
    home_red_cards        = Column(Integer, nullable=True)
    away_red_cards        = Column(Integer, nullable=True)

    # Contexte qualitatif saisi par l'analyste (absences, enjeu, météo…)
    context_note  = Column(Text, nullable=True)
    #: Modulateurs manuels appliqués aux buts attendus (1.0 = neutre)
    home_boost    = Column(Float, default=1.0)
    away_boost    = Column(Float, default=1.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    competition = relationship("Competition", back_populates="matches")
    home_team   = relationship("SportTeam", foreign_keys=[home_team_id],
                               back_populates="home_matches")
    away_team   = relationship("SportTeam", foreign_keys=[away_team_id],
                               back_populates="away_matches")
    odds_quotes = relationship("OddsQuote", back_populates="match",
                               cascade="all, delete-orphan")
    bets        = relationship("SportBet", back_populates="match")

    __table_args__ = (
        Index("ix_sport_match_teams", "home_team_id", "away_team_id"),
    )

    @property
    def is_played(self) -> bool:
        return (
            self.status == MatchStatus.FINISHED
            and self.home_goals is not None
            and self.away_goals is not None
        )


class OddsQuote(Base):
    """Cote relevée chez un bookmaker à un instant donné.

    Conserver l'historique permet de mesurer le mouvement de la ligne et le CLV
    (écart entre la cote prise et la cote de clôture).
    """
    __tablename__ = "sport_odds_quotes"

    id          = Column(Integer, primary_key=True, index=True)
    match_id    = Column(Integer, ForeignKey("sport_matches.id"), nullable=False, index=True)
    bookmaker   = Column(String(80), nullable=True)
    market      = Column(String(40), nullable=False)   # ex. "1X2", "OU_2.5", "AH_-0.5"
    selection   = Column(String(40), nullable=False)   # ex. "HOME", "OVER", "YES"
    odds        = Column(Float, nullable=False)
    is_closing  = Column(Boolean, default=False)       # cote de clôture
    captured_at = Column(DateTime(timezone=True), server_default=func.now())

    match = relationship("SportMatch", back_populates="odds_quotes")

    __table_args__ = (
        Index("ix_sport_odds_market", "match_id", "market", "selection"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  PARIS ET BANKROLL
# ─────────────────────────────────────────────────────────────────────────────

class SportBet(Base):
    """Pari joué. Les champs `model_probability` / `edge` figent l'avis du
    modèle au moment de la mise : c'est ce qui permet plus tard de vérifier si
    l'avantage estimé se matérialise réellement."""
    __tablename__ = "sport_bets"

    id        = Column(Integer, primary_key=True, index=True)
    match_id  = Column(Integer, ForeignKey("sport_matches.id"), nullable=True, index=True)
    label     = Column(String(160), nullable=True)     # libellé libre
    market    = Column(String(40), nullable=False)
    selection = Column(String(40), nullable=False)
    odds      = Column(Float, nullable=False)
    stake     = Column(Float, nullable=False)
    bookmaker = Column(String(80), nullable=True)

    status  = Column(SAEnum(BetStatus), default=BetStatus.PENDING, nullable=False, index=True)
    profit  = Column(Float, nullable=True)             # gain net, calculé au règlement

    model_probability = Column(Float, nullable=True)
    edge              = Column(Float, nullable=True)
    kelly_stake_pct   = Column(Float, nullable=True)
    closing_odds      = Column(Float, nullable=True)   # pour le CLV

    notes      = Column(Text, nullable=True)
    placed_at  = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    settled_at = Column(DateTime(timezone=True), nullable=True)

    match = relationship("SportMatch", back_populates="bets")


class BankrollTransaction(Base):
    """Mouvement de capital hors paris (dépôt, retrait, ajustement)."""
    __tablename__ = "sport_bankroll_transactions"

    id         = Column(Integer, primary_key=True, index=True)
    type       = Column(SAEnum(BankrollTxType), nullable=False)
    amount     = Column(Float, nullable=False)         # toujours positif
    currency   = Column(String(10), default="EUR")
    note       = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
