"""
SOKORA SPORT — Moteur d'analyse des matchs (v1)

Module 100 % Python standard : aucune dépendance externe, aucun accès base de
données. Toute la logique statistique vit ici afin de pouvoir être testée
isolément (voir backend/tests/test_analytics_sport.py).

Chaîne d'analyse implémentée :

    historique des matchs
        └─> forces d'attaque / défense pondérées par la fraîcheur (demi-vie)
             └─> buts attendus (λ domicile, λ extérieur) + avantage du terrain
                  └─> grille de scores Poisson corrigée Dixon-Coles
                       └─> probabilités de tous les marchés (1X2, O/U, BTTS, AH…)
                            └─> cotes équitables, comparaison bookmaker,
                                edge (valeur), mise de Kelly, verdict

Vocabulaire utilisé dans tout le module :
    λ (lambda)  : nombre de buts attendus d'une équipe sur le match
    edge        : espérance de gain par unité misée = p * cote - 1
    no-vig      : probabilités du bookmaker débarrassées de sa marge
    CLV         : Closing Line Value, écart entre la cote prise et la cote
                  de clôture (meilleur indicateur long terme d'un parieur)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

# ════════════════════════════════════════════════════════════════════════════
#  CONSTANTES DE MODÉLISATION
# ════════════════════════════════════════════════════════════════════════════

#: Demi-vie de la pondération temporelle : un match vieux de 180 jours pèse
#: moitié moins qu'un match joué aujourd'hui.
DEFAULT_HALF_LIFE_DAYS = 180.0

#: Force du « retour à la moyenne ». Équivaut à K matchs fictifs de niveau
#: moyen ajoutés à chaque équipe : protège des échantillons trop courts.
DEFAULT_SHRINKAGE = 4.0

#: Correction Dixon-Coles des petits scores (0-0, 1-0, 0-1, 1-1) que le modèle
#: Poisson pur sous-estime. Valeur négative classique sur le football.
DEFAULT_RHO = -0.05

#: Taille de la grille de scores (0..MAX_GOALS buts par équipe).
DEFAULT_MAX_GOALS = 10

#: Lignes de buts totaux proposées par défaut.
DEFAULT_TOTAL_LINES = (0.5, 1.5, 2.5, 3.5, 4.5, 5.5)

#: Lignes de handicap asiatique (perspective domicile) proposées par défaut.
DEFAULT_HANDICAP_LINES = (-2.5, -2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5)

#: Bornes de sécurité sur les λ : évite qu'un échantillon aberrant produise
#: une prévision absurde (0 but ou 8 buts attendus).
LAMBDA_MIN, LAMBDA_MAX = 0.15, 5.0

#: Valeurs de repli quand l'historique est vide (moyennes football européen).
FALLBACK_HOME_GOALS = 1.50
FALLBACK_AWAY_GOALS = 1.15

#: Décote appliquée à tout edge estimé (« malédiction du vainqueur »).
#: On retient la meilleure des ~30 sélections d'un match ; chacune porte une
#: erreur d'estimation, et le maximum d'un ensemble d'estimations bruitées est
#: biaisé vers le haut. Retirer 2 points d'edge est une correction prudente et
#: volontairement grossière : mieux vaut rater une occasion que financer du bruit.
DEFAULT_EDGE_HAIRCUT = 0.02


# ════════════════════════════════════════════════════════════════════════════
#  STRUCTURES D'ENTRÉE
# ════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class MatchRecord:
    """Un match terminé, unité de base de tous les calculs.

    `home` / `away` sont des identifiants d'équipe opaques (int ou str).
    """
    home: object
    away: object
    home_goals: int
    away_goals: int
    kickoff: Optional[datetime] = None
    competition: Optional[object] = None
    home_xg: Optional[float] = None
    away_xg: Optional[float] = None

    @property
    def total_goals(self) -> int:
        return self.home_goals + self.away_goals

    @property
    def margin(self) -> int:
        """Différence de buts vue du domicile."""
        return self.home_goals - self.away_goals

    @property
    def outcome(self) -> str:
        if self.margin > 0:
            return "HOME"
        if self.margin < 0:
            return "AWAY"
        return "DRAW"


@dataclass
class TeamStrength:
    """Forces relatives d'une équipe (1.00 = niveau moyen de l'échantillon)."""
    team: object
    attack: float = 1.0
    defense: float = 1.0
    matches: int = 0
    weight: float = 0.0

    def as_dict(self) -> dict:
        return {
            "team": self.team,
            "attack": round(self.attack, 4),
            "defense": round(self.defense, 4),
            "matches": self.matches,
            "sample_weight": round(self.weight, 3),
        }


@dataclass
class LeagueBaseline:
    """Repères de la compétition, calculés sur l'historique fourni."""
    goals_per_team: float = (FALLBACK_HOME_GOALS + FALLBACK_AWAY_GOALS) / 2
    home_goals: float = FALLBACK_HOME_GOALS
    away_goals: float = FALLBACK_AWAY_GOALS
    home_advantage: float = 1.0
    matches: int = 0

    def as_dict(self) -> dict:
        return {
            "matches": self.matches,
            "goals_per_team": round(self.goals_per_team, 3),
            "avg_home_goals": round(self.home_goals, 3),
            "avg_away_goals": round(self.away_goals, 3),
            "home_advantage": round(self.home_advantage, 4),
            "avg_total_goals": round(self.home_goals + self.away_goals, 3),
        }


@dataclass
class BetRecord:
    """Un pari joué, pour le suivi de performance."""
    stake: float
    odds: float
    status: str                       # PENDING / WON / LOST / VOID / CASHOUT
    profit: Optional[float] = None    # gain net ; calculé si absent
    market: str = "1X2"
    selection: str = ""
    model_prob: Optional[float] = None
    closing_odds: Optional[float] = None
    placed_at: Optional[datetime] = None
    label: str = ""

    def net_profit(self) -> float:
        """Gain net du pari (0 si toujours en cours)."""
        if self.profit is not None:
            return float(self.profit)
        st = (self.status or "").upper()
        if st == "WON":
            return self.stake * (self.odds - 1.0)
        if st == "HALF_WON":
            return self.stake * (self.odds - 1.0) / 2.0
        if st == "LOST":
            return -self.stake
        if st == "HALF_LOST":
            return -self.stake / 2.0
        return 0.0  # PENDING, VOID, PUSH

    def is_settled(self) -> bool:
        return (self.status or "").upper() not in ("PENDING", "")

    def is_resolved_stake(self) -> bool:
        """Vrai si la mise a réellement été exposée (exclut VOID/PUSH)."""
        return (self.status or "").upper() in (
            "WON", "LOST", "HALF_WON", "HALF_LOST", "CASHOUT",
        )


# ════════════════════════════════════════════════════════════════════════════
#  OUTILS PROBABILISTES DE BASE
# ════════════════════════════════════════════════════════════════════════════

def poisson_pmf(k: int, lam: float) -> float:
    """P(X = k) pour X ~ Poisson(lam)."""
    if k < 0:
        return 0.0
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam + k * math.log(lam) - math.lgamma(k + 1))


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def implied_probability(odds: float) -> float:
    """Probabilité brute (marge incluse) d'une cote décimale."""
    if odds is None or odds <= 1.0:
        return 0.0
    return 1.0 / float(odds)


def fair_odds(probability: float) -> Optional[float]:
    """Cote équitable correspondant à une probabilité."""
    if probability is None or probability <= 0:
        return None
    return 1.0 / probability


def overround(odds: Sequence[float]) -> Optional[float]:
    """Marge du bookmaker sur un marché complet (0.05 = 5 %)."""
    valid = [o for o in odds if o and o > 1.0]
    if len(valid) < 2:
        return None
    return sum(1.0 / o for o in valid) - 1.0


def remove_margin(
    odds_by_selection: Dict[str, float],
    method: str = "proportional",
) -> Dict[str, float]:
    """Retire la marge du bookmaker → probabilités « no-vig ».

    - ``proportional`` : division par la somme des probabilités implicites.
      Rapide, mais surestime légèrement les gros favoris.
    - ``odds_ratio``   : méthode de Cheung, résolue par dichotomie. Répartit la
      marge de façon moins favorable aux favoris, plus réaliste sur le 1X2.
    - ``power``        : probabilités élevées à la puissance k.
    """
    quotes = {k: float(v) for k, v in odds_by_selection.items() if v and float(v) > 1.0}
    if not quotes:
        return {}
    raw = {k: 1.0 / v for k, v in quotes.items()}
    total = sum(raw.values())
    if len(raw) == 1 or total <= 0:
        return raw

    if method == "proportional":
        return {k: v / total for k, v in raw.items()}

    if method == "power":
        def total_for(k: float) -> float:
            return sum(p ** k for p in raw.values())
        lo, hi = 0.2, 5.0
        for _ in range(80):
            mid = (lo + hi) / 2
            if total_for(mid) > 1.0:
                lo = mid
            else:
                hi = mid
        k = (lo + hi) / 2
        adjusted = {sel: p ** k for sel, p in raw.items()}
        s = sum(adjusted.values())
        return {sel: p / s for sel, p in adjusted.items()}

    if method == "odds_ratio":
        # p_fair tel que  OR = p_book(1-p_fair) / (p_fair(1-p_book))  constant.
        def fair_for(c: float) -> Dict[str, float]:
            return {
                sel: p / (c + p - c * p) if (c + p - c * p) > 0 else p
                for sel, p in raw.items()
            }
        lo, hi = 0.2, 20.0
        for _ in range(100):
            mid = (lo + hi) / 2
            if sum(fair_for(mid).values()) > 1.0:
                lo = mid
            else:
                hi = mid
        c = (lo + hi) / 2
        adjusted = fair_for(c)
        s = sum(adjusted.values())
        return {sel: p / s for sel, p in adjusted.items()}

    raise ValueError(f"Méthode de dévigorisation inconnue : {method}")


def edge(probability: float, odds: float) -> Optional[float]:
    """Espérance de gain par unité misée. 0.06 = +6 % de valeur attendue."""
    if not odds or odds <= 1.0 or probability is None:
        return None
    return probability * float(odds) - 1.0


def kelly_stake(
    probability: float,
    odds: float,
    bankroll: float = 1.0,
    fraction: float = 0.25,
    cap_pct: float = 0.05,
) -> dict:
    """Mise optimale de Kelly, fractionnée puis plafonnée.

    Le Kelly plein est trop volatil pour un usage réel : on applique un
    coefficient (``fraction``, 1/4 par défaut) et un plafond en pourcentage de
    la bankroll (``cap_pct``, 5 % par défaut).
    """
    if not odds or odds <= 1.0 or probability is None or probability <= 0:
        return {"full_kelly": 0.0, "fraction_used": fraction, "stake_pct": 0.0, "stake": 0.0}
    b = float(odds) - 1.0
    full = (probability * float(odds) - 1.0) / b
    full = max(0.0, full)
    stake_pct = min(full * fraction, cap_pct)
    return {
        "full_kelly": round(full, 4),
        "fraction_used": fraction,
        "stake_pct": round(stake_pct, 4),
        "stake": round(max(0.0, bankroll) * stake_pct, 2),
    }


def blend_probabilities(
    model_prob: float,
    market_prob: Optional[float],
    market_weight: float = 0.35,
) -> float:
    """Mélange modèle / marché.

    Le marché agrège l'information de milliers d'acteurs : s'y adosser
    partiellement réduit le risque de sur-confiance du modèle. Poids marché de
    0 (modèle pur) à 1 (marché pur).
    """
    if market_prob is None:
        return model_prob
    w = clamp(market_weight, 0.0, 1.0)
    return (1.0 - w) * model_prob + w * market_prob


# ════════════════════════════════════════════════════════════════════════════
#  ESTIMATION DES FORCES D'ÉQUIPE
# ════════════════════════════════════════════════════════════════════════════

def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def recency_weight(
    kickoff: Optional[datetime],
    reference: Optional[datetime] = None,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
) -> float:
    """Poids d'un match selon son ancienneté (décroissance exponentielle)."""
    if kickoff is None or half_life_days <= 0:
        return 1.0
    ref = _as_utc(reference) or datetime.now(timezone.utc)
    ko = _as_utc(kickoff)
    days = max(0.0, (ref - ko).total_seconds() / 86400.0)
    return 0.5 ** (days / half_life_days)


def league_baseline(
    matches: Sequence[MatchRecord],
    reference: Optional[datetime] = None,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
) -> LeagueBaseline:
    """Moyennes pondérées de la compétition + avantage du terrain."""
    total_w = 0.0
    home_goals = 0.0
    away_goals = 0.0
    for m in matches:
        w = recency_weight(m.kickoff, reference, half_life_days)
        total_w += w
        home_goals += w * m.home_goals
        away_goals += w * m.away_goals
    if total_w <= 0:
        return LeagueBaseline(matches=len(matches))

    avg_home = home_goals / total_w
    avg_away = away_goals / total_w
    # Repli si un côté est dégénéré (ex. 0 but marqué à l'extérieur).
    avg_home = max(avg_home, 0.05)
    avg_away = max(avg_away, 0.05)
    mu = (avg_home + avg_away) / 2.0
    # H tel que λ_dom ∝ mu * H et λ_ext ∝ mu / H  →  H = √(avg_home/avg_away)
    home_adv = math.sqrt(avg_home / avg_away)
    return LeagueBaseline(
        goals_per_team=mu,
        home_goals=avg_home,
        away_goals=avg_away,
        home_advantage=home_adv,
        matches=len(matches),
    )


def team_strengths(
    matches: Sequence[MatchRecord],
    reference: Optional[datetime] = None,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
    shrinkage: float = DEFAULT_SHRINKAGE,
    iterations: int = 8,
    baseline: Optional[LeagueBaseline] = None,
) -> Tuple[Dict[object, TeamStrength], LeagueBaseline]:
    """Forces d'attaque et de défense par équipe.

    Ajustement itératif (proportional fitting) d'un modèle
    ``λ = mu · attaque_équipe · défense_adverse · avantage_terrain``.
    À chaque itération, la force brute (buts réels / buts attendus) est ramenée
    vers 1.00 proportionnellement à la taille de l'échantillon : une équipe avec
    3 matchs joués reste proche de la moyenne, une équipe avec 30 matchs
    exprime pleinement sa force.

    Retourne (forces, repères de la compétition).
    """
    base = baseline or league_baseline(matches, reference, half_life_days)
    mu, hadv = base.goals_per_team, base.home_advantage

    strengths: Dict[object, TeamStrength] = {}
    weighted: List[Tuple[MatchRecord, float]] = []
    for m in matches:
        w = recency_weight(m.kickoff, reference, half_life_days)
        if w <= 0:
            continue
        weighted.append((m, w))
        for team in (m.home, m.away):
            st = strengths.setdefault(team, TeamStrength(team=team))
            st.matches += 1
            st.weight += w

    if not weighted:
        return strengths, base

    def renormalise() -> None:
        """Moyenne pondérée des forces ramenée à 1.00."""
        tw = sum(st.weight for st in strengths.values()) or 1.0
        mean_atk = sum(st.attack * st.weight for st in strengths.values()) / tw
        mean_def = sum(st.defense * st.weight for st in strengths.values()) / tw
        if mean_atk > 0:
            for st in strengths.values():
                st.attack /= mean_atk
        if mean_def > 0:
            for st in strengths.values():
                st.defense /= mean_def

    # ── Étape 1 : ajustement itératif (buts réels ≈ buts attendus) ────────────
    damping = 0.8          # amortit les oscillations d'une itération à l'autre
    tolerance = 1e-4
    for _ in range(max(1, iterations)):
        goals_for: Dict[object, float] = {t: 0.0 for t in strengths}
        goals_against: Dict[object, float] = {t: 0.0 for t in strengths}
        exp_for: Dict[object, float] = {t: 0.0 for t in strengths}
        exp_against: Dict[object, float] = {t: 0.0 for t in strengths}

        for m, w in weighted:
            h, a = strengths[m.home], strengths[m.away]
            lam_h = mu * h.attack * a.defense * hadv
            lam_a = mu * a.attack * h.defense / hadv
            goals_for[m.home] += w * m.home_goals
            goals_for[m.away] += w * m.away_goals
            goals_against[m.home] += w * m.away_goals
            goals_against[m.away] += w * m.home_goals
            exp_for[m.home] += w * lam_h
            exp_for[m.away] += w * lam_a
            exp_against[m.home] += w * lam_a
            exp_against[m.away] += w * lam_h

        largest_move = 0.0
        for team, st in strengths.items():
            if exp_for[team] > 0:
                ratio = max(goals_for[team] / exp_for[team], 1e-3)
                new_atk = clamp(st.attack * (ratio ** damping), 0.2, 4.0)
                largest_move = max(largest_move, abs(new_atk - st.attack))
                st.attack = new_atk
            if exp_against[team] > 0:
                ratio = max(goals_against[team] / exp_against[team], 1e-3)
                new_def = clamp(st.defense * (ratio ** damping), 0.2, 4.0)
                largest_move = max(largest_move, abs(new_def - st.defense))
                st.defense = new_def

        renormalise()
        if largest_move < tolerance:
            break

    # ── Étape 2 : rappel vers la moyenne, appliqué une seule fois ─────────────
    # Fait en échelle logarithmique (les forces sont multiplicatives) et dosé par
    # le poids de l'échantillon : peu de matchs ⇒ force ramenée près de 1.00.
    if shrinkage > 0:
        for st in strengths.values():
            k = st.weight / (st.weight + shrinkage)
            st.attack = math.exp(math.log(max(st.attack, 1e-6)) * k)
            st.defense = math.exp(math.log(max(st.defense, 1e-6)) * k)
        renormalise()

    return strengths, base


def expected_goals(
    home: Optional[TeamStrength],
    away: Optional[TeamStrength],
    baseline: LeagueBaseline,
    home_boost: float = 1.0,
    away_boost: float = 1.0,
) -> Tuple[float, float]:
    """Buts attendus des deux équipes.

    ``home_boost`` / ``away_boost`` permettent d'intégrer manuellement un
    contexte non statistique (absences, enjeu, météo) : 0.90 = -10 % d'attaque.
    """
    mu, hadv = baseline.goals_per_team, baseline.home_advantage
    h_atk = home.attack if home else 1.0
    h_def = home.defense if home else 1.0
    a_atk = away.attack if away else 1.0
    a_def = away.defense if away else 1.0
    lam_h = mu * h_atk * a_def * hadv * max(0.1, home_boost)
    lam_a = mu * a_atk * h_def / hadv * max(0.1, away_boost)
    return clamp(lam_h, LAMBDA_MIN, LAMBDA_MAX), clamp(lam_a, LAMBDA_MIN, LAMBDA_MAX)


# ════════════════════════════════════════════════════════════════════════════
#  GRILLE DE SCORES
# ════════════════════════════════════════════════════════════════════════════

def dixon_coles_tau(x: int, y: int, lam: float, mu: float, rho: float) -> float:
    """Correction Dixon-Coles sur les quatre scores les plus bas."""
    if x == 0 and y == 0:
        return 1.0 - lam * mu * rho
    if x == 0 and y == 1:
        return 1.0 + lam * rho
    if x == 1 and y == 0:
        return 1.0 + mu * rho
    if x == 1 and y == 1:
        return 1.0 - rho
    return 1.0


def score_grid(
    lam_home: float,
    lam_away: float,
    max_goals: int = DEFAULT_MAX_GOALS,
    rho: float = DEFAULT_RHO,
) -> List[List[float]]:
    """Matrice normalisée des probabilités de score exact.

    ``grid[i][j]`` = P(domicile marque i, extérieur marque j).
    """
    grid = [[0.0] * (max_goals + 1) for _ in range(max_goals + 1)]
    for i in range(max_goals + 1):
        pi = poisson_pmf(i, lam_home)
        for j in range(max_goals + 1):
            p = pi * poisson_pmf(j, lam_away)
            grid[i][j] = max(0.0, p * dixon_coles_tau(i, j, lam_home, lam_away, rho))
    total = sum(sum(row) for row in grid)
    if total > 0:
        grid = [[cell / total for cell in row] for row in grid]
    return grid


def _iter_grid(grid: Sequence[Sequence[float]]):
    for i, row in enumerate(grid):
        for j, p in enumerate(row):
            if p > 0:
                yield i, j, p


def totals_market(grid: Sequence[Sequence[float]], line: float) -> Dict[str, float]:
    """Plus/moins de buts pour une ligne donnée (gère le remboursement)."""
    over = under = push = 0.0
    for i, j, p in _iter_grid(grid):
        total = i + j
        if total > line:
            over += p
        elif total < line:
            under += p
        else:
            push += p
    out = {"OVER": over, "UNDER": under}
    if push > 0:
        out["PUSH"] = push
    return out


def asian_handicap(grid: Sequence[Sequence[float]], line: float) -> Dict[str, float]:
    """Handicap asiatique vu du domicile (``line`` = buts offerts au domicile).

    Les lignes en quart de but (±0.25, ±0.75) sont traitées comme la moyenne
    des deux demi-lignes encadrantes, comme chez les bookmakers.
    """
    # Ligne en quart de but (.25 / .75) → moyenne des deux demi-lignes voisines.
    if round(abs(line) * 4) % 2 == 1:
        a = asian_handicap(grid, line - 0.25)
        b = asian_handicap(grid, line + 0.25)
        merged = {
            k: (a.get(k, 0.0) + b.get(k, 0.0)) / 2
            for k in ("HOME", "AWAY", "PUSH")
        }
        return {k: v for k, v in merged.items() if v > 1e-12 or k != "PUSH"}

    home = away = push = 0.0
    for i, j, p in _iter_grid(grid):
        adjusted = (i - j) + line
        if adjusted > 1e-9:
            home += p
        elif adjusted < -1e-9:
            away += p
        else:
            push += p
    out = {"HOME": home, "AWAY": away}
    if push > 1e-12:
        out["PUSH"] = push
    return out


def market_probabilities(
    grid: Sequence[Sequence[float]],
    total_lines: Sequence[float] = DEFAULT_TOTAL_LINES,
    handicap_lines: Sequence[float] = DEFAULT_HANDICAP_LINES,
    top_scores: int = 8,
) -> Dict[str, Dict[str, float]]:
    """Toutes les probabilités de marché déduites de la grille de scores."""
    home_win = draw = away_win = 0.0
    btts_yes = 0.0
    home_cs = away_cs = 0.0          # clean sheet (aucun but encaissé)
    home_fts = away_fts = 0.0        # failed to score
    odd_total = 0.0
    home_goals_exp = away_goals_exp = 0.0
    scores: List[Tuple[str, float]] = []

    for i, j, p in _iter_grid(grid):
        if i > j:
            home_win += p
        elif i == j:
            draw += p
        else:
            away_win += p
        if i > 0 and j > 0:
            btts_yes += p
        if j == 0:
            home_cs += p
        if i == 0:
            away_cs += p
        if i == 0:
            home_fts += p
        if j == 0:
            away_fts += p
        if (i + j) % 2 == 1:
            odd_total += p
        home_goals_exp += p * i
        away_goals_exp += p * j
        scores.append((f"{i}-{j}", p))

    markets: Dict[str, Dict[str, float]] = {
        "1X2": {"HOME": home_win, "DRAW": draw, "AWAY": away_win},
        "DOUBLE_CHANCE": {
            "1X": home_win + draw,
            "12": home_win + away_win,
            "X2": draw + away_win,
        },
        "BTTS": {"YES": btts_yes, "NO": 1.0 - btts_yes},
        "ODD_EVEN": {"ODD": odd_total, "EVEN": 1.0 - odd_total},
        "CLEAN_SHEET": {"HOME": home_cs, "AWAY": away_cs},
        "TO_SCORE": {"HOME": 1.0 - home_fts, "AWAY": 1.0 - away_fts},
        "WIN_TO_NIL": {
            "HOME": sum(p for i, j, p in _iter_grid(grid) if i > 0 and j == 0),
            "AWAY": sum(p for i, j, p in _iter_grid(grid) if j > 0 and i == 0),
        },
    }

    for line in total_lines:
        markets[f"OU_{line}"] = totals_market(grid, line)
    for line in handicap_lines:
        markets[f"AH_{line}"] = asian_handicap(grid, line)

    # Totaux par équipe (marché « équipe X marque plus de N »)
    for line in (0.5, 1.5, 2.5):
        h_over = sum(p for i, _j, p in _iter_grid(grid) if i > line)
        a_over = sum(p for _i, j, p in _iter_grid(grid) if j > line)
        markets[f"HOME_OU_{line}"] = {"OVER": h_over, "UNDER": 1.0 - h_over}
        markets[f"AWAY_OU_{line}"] = {"OVER": a_over, "UNDER": 1.0 - a_over}

    scores.sort(key=lambda kv: kv[1], reverse=True)
    markets["CORRECT_SCORE"] = dict(scores[:top_scores])

    markets["_EXPECTED"] = {
        "home_goals": home_goals_exp,
        "away_goals": away_goals_exp,
        "total_goals": home_goals_exp + away_goals_exp,
        "supremacy": home_goals_exp - away_goals_exp,
    }
    return markets


def most_likely_scores(grid: Sequence[Sequence[float]], top: int = 5) -> List[dict]:
    """Scores exacts les plus probables, prêts pour l'affichage."""
    scores = [
        {"score": f"{i}-{j}", "probability": p, "fair_odds": fair_odds(p)}
        for i, j, p in _iter_grid(grid)
    ]
    scores.sort(key=lambda s: s["probability"], reverse=True)
    return scores[:top]


# ════════════════════════════════════════════════════════════════════════════
#  FORME, SÉRIES, ELO, CONFRONTATIONS
# ════════════════════════════════════════════════════════════════════════════

def _sorted_desc(matches: Sequence[MatchRecord]) -> List[MatchRecord]:
    """Du plus récent au plus ancien (les matchs sans date passent en dernier)."""
    return sorted(
        matches,
        key=lambda m: _as_utc(m.kickoff) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )


def team_matches(
    matches: Sequence[MatchRecord],
    team: object,
    venue: Optional[str] = None,
) -> List[MatchRecord]:
    """Matchs d'une équipe, du plus récent au plus ancien.

    ``venue`` : None (tous), "HOME" (à domicile), "AWAY" (à l'extérieur).
    """
    out = []
    for m in matches:
        if venue in (None, "ALL"):
            if m.home == team or m.away == team:
                out.append(m)
        elif venue == "HOME" and m.home == team:
            out.append(m)
        elif venue == "AWAY" and m.away == team:
            out.append(m)
    return _sorted_desc(out)


def team_form(
    matches: Sequence[MatchRecord],
    team: object,
    last_n: Optional[int] = 10,
    venue: Optional[str] = None,
) -> dict:
    """Bloc de statistiques de forme d'une équipe.

    Contient tout ce qu'un analyste regarde avant de parier : points par match,
    buts marqués/encaissés, taux over/under, BTTS, clean sheets, série en cours.
    """
    selection = team_matches(matches, team, venue)
    if last_n:
        selection = selection[:last_n]
    played = len(selection)
    empty = {
        "team": team, "venue": venue or "ALL", "played": 0, "wins": 0, "draws": 0,
        "losses": 0, "points": 0, "ppg": 0.0, "goals_for": 0, "goals_against": 0,
        "goal_diff": 0, "avg_goals_for": 0.0, "avg_goals_against": 0.0,
        "avg_total_goals": 0.0, "btts_rate": 0.0, "clean_sheet_rate": 0.0,
        "failed_to_score_rate": 0.0, "over_rates": {}, "form": "",
        "current_streak": {"type": None, "length": 0}, "unbeaten_run": 0,
        "last_results": [],
    }
    if played == 0:
        return empty

    wins = draws = losses = 0
    gf = ga = 0
    btts = cs = fts = 0
    over_counts = {line: 0 for line in (0.5, 1.5, 2.5, 3.5)}
    results: List[str] = []
    details: List[dict] = []

    for m in selection:
        at_home = m.home == team
        scored = m.home_goals if at_home else m.away_goals
        conceded = m.away_goals if at_home else m.home_goals
        gf += scored
        ga += conceded
        if scored > conceded:
            wins += 1
            res = "W"
        elif scored == conceded:
            draws += 1
            res = "D"
        else:
            losses += 1
            res = "L"
        results.append(res)
        if scored > 0 and conceded > 0:
            btts += 1
        if conceded == 0:
            cs += 1
        if scored == 0:
            fts += 1
        for line in over_counts:
            if m.total_goals > line:
                over_counts[line] += 1
        details.append({
            "kickoff": m.kickoff.isoformat() if m.kickoff else None,
            "venue": "HOME" if at_home else "AWAY",
            "opponent": m.away if at_home else m.home,
            "score": f"{scored}-{conceded}",
            "result": res,
            "total_goals": m.total_goals,
        })

    points = wins * 3 + draws
    streak_type = results[0]
    streak_len = 0
    for r in results:
        if r == streak_type:
            streak_len += 1
        else:
            break
    unbeaten = 0
    for r in results:
        if r in ("W", "D"):
            unbeaten += 1
        else:
            break

    return {
        "team": team,
        "venue": venue or "ALL",
        "played": played,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "points": points,
        "ppg": round(points / played, 3),
        "goals_for": gf,
        "goals_against": ga,
        "goal_diff": gf - ga,
        "avg_goals_for": round(gf / played, 3),
        "avg_goals_against": round(ga / played, 3),
        "avg_total_goals": round((gf + ga) / played, 3),
        "btts_rate": round(btts / played, 3),
        "clean_sheet_rate": round(cs / played, 3),
        "failed_to_score_rate": round(fts / played, 3),
        "over_rates": {f"over_{line}": round(c / played, 3) for line, c in over_counts.items()},
        "form": "".join(results[:5]),
        "current_streak": {"type": streak_type, "length": streak_len},
        "unbeaten_run": unbeaten,
        "last_results": details[:10],
    }


def head_to_head(
    matches: Sequence[MatchRecord],
    team_a: object,
    team_b: object,
    last_n: int = 10,
) -> dict:
    """Bilan des confrontations directes, vu de ``team_a``."""
    duels = [
        m for m in _sorted_desc(matches)
        if {m.home, m.away} == {team_a, team_b}
    ][:last_n]
    if not duels:
        return {"played": 0, "a_wins": 0, "draws": 0, "b_wins": 0,
                "avg_total_goals": 0.0, "btts_rate": 0.0, "matches": []}

    a_wins = b_wins = draws = 0
    total_goals = 0
    btts = 0
    rows = []
    for m in duels:
        total_goals += m.total_goals
        if m.home_goals > 0 and m.away_goals > 0:
            btts += 1
        a_home = m.home == team_a
        a_goals = m.home_goals if a_home else m.away_goals
        b_goals = m.away_goals if a_home else m.home_goals
        if a_goals > b_goals:
            a_wins += 1
        elif a_goals < b_goals:
            b_wins += 1
        else:
            draws += 1
        rows.append({
            "kickoff": m.kickoff.isoformat() if m.kickoff else None,
            "home": m.home, "away": m.away,
            "score": f"{m.home_goals}-{m.away_goals}",
            "total_goals": m.total_goals,
        })
    n = len(duels)
    return {
        "played": n,
        "a_wins": a_wins,
        "draws": draws,
        "b_wins": b_wins,
        "a_win_rate": round(a_wins / n, 3),
        "avg_total_goals": round(total_goals / n, 3),
        "btts_rate": round(btts / n, 3),
        "matches": rows,
    }


def elo_ratings(
    matches: Sequence[MatchRecord],
    k_factor: float = 20.0,
    home_advantage: float = 60.0,
    start_rating: float = 1500.0,
    goal_diff_boost: bool = True,
) -> Dict[object, float]:
    """Classement Elo, second modèle indépendant pour recouper les λ.

    Le facteur K est amplifié par l'écart de buts (comme le Elo mondial FIFA),
    ce qui récompense les victoires larges.
    """
    ratings: Dict[object, float] = {}
    for m in _sorted_desc(matches)[::-1]:  # chronologique
        rh = ratings.setdefault(m.home, start_rating)
        ra = ratings.setdefault(m.away, start_rating)
        exp_h = 1.0 / (1.0 + 10 ** (-((rh + home_advantage) - ra) / 400.0))
        if m.margin > 0:
            actual = 1.0
        elif m.margin < 0:
            actual = 0.0
        else:
            actual = 0.5
        k = k_factor
        if goal_diff_boost:
            gd = abs(m.margin)
            if gd == 2:
                k *= 1.5
            elif gd >= 3:
                k *= (1.75 + (gd - 3) / 8.0)
        delta = k * (actual - exp_h)
        ratings[m.home] = rh + delta
        ratings[m.away] = ra - delta
    return ratings


def elo_probabilities(
    elo_home: float,
    elo_away: float,
    home_advantage: float = 60.0,
    draw_base: float = 0.28,
    draw_spread: float = 350.0,
) -> Dict[str, float]:
    """Probabilités 1X2 approchées depuis l'Elo (contrôle de cohérence)."""
    diff = (elo_home + home_advantage) - elo_away
    expected = 1.0 / (1.0 + 10 ** (-diff / 400.0))
    p_draw = clamp(draw_base * math.exp(-((diff / draw_spread) ** 2)), 0.05, 0.40)
    p_home = clamp(expected - p_draw / 2.0, 0.01, 0.98)
    p_away = clamp(1.0 - expected - p_draw / 2.0, 0.01, 0.98)
    total = p_home + p_draw + p_away
    return {"HOME": p_home / total, "DRAW": p_draw / total, "AWAY": p_away / total}


def standings(
    matches: Sequence[MatchRecord],
    team_names: Optional[Dict[object, str]] = None,
) -> List[dict]:
    """Classement calculé + colonnes avancées (PPG domicile/extérieur, forme)."""
    table: Dict[object, dict] = {}

    def row(team):
        return table.setdefault(team, {
            "team": team,
            "name": (team_names or {}).get(team, str(team)),
            "played": 0, "wins": 0, "draws": 0, "losses": 0,
            "goals_for": 0, "goals_against": 0, "points": 0,
            "home_played": 0, "home_points": 0,
            "away_played": 0, "away_points": 0,
            "over25": 0, "btts": 0,
        })

    for m in matches:
        h, a = row(m.home), row(m.away)
        h["played"] += 1
        a["played"] += 1
        h["home_played"] += 1
        a["away_played"] += 1
        h["goals_for"] += m.home_goals
        h["goals_against"] += m.away_goals
        a["goals_for"] += m.away_goals
        a["goals_against"] += m.home_goals
        if m.total_goals > 2.5:
            h["over25"] += 1
            a["over25"] += 1
        if m.home_goals > 0 and m.away_goals > 0:
            h["btts"] += 1
            a["btts"] += 1
        if m.margin > 0:
            h["wins"] += 1
            a["losses"] += 1
            h["points"] += 3
            h["home_points"] += 3
        elif m.margin < 0:
            a["wins"] += 1
            h["losses"] += 1
            a["points"] += 3
            a["away_points"] += 3
        else:
            h["draws"] += 1
            a["draws"] += 1
            h["points"] += 1
            a["points"] += 1
            h["home_points"] += 1
            a["away_points"] += 1

    rows = []
    for team, r in table.items():
        played = max(1, r["played"])
        form = team_form(matches, team, last_n=5)
        rows.append({
            **r,
            "goal_diff": r["goals_for"] - r["goals_against"],
            "ppg": round(r["points"] / played, 3),
            "home_ppg": round(r["home_points"] / r["home_played"], 3) if r["home_played"] else 0.0,
            "away_ppg": round(r["away_points"] / r["away_played"], 3) if r["away_played"] else 0.0,
            "over25_rate": round(r["over25"] / played, 3),
            "btts_rate": round(r["btts"] / played, 3),
            "form": form["form"],
            "ppg_last5": form["ppg"],
        })
    rows.sort(key=lambda r: (r["points"], r["goal_diff"], r["goals_for"]), reverse=True)
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows


# ════════════════════════════════════════════════════════════════════════════
#  DÉTECTION DE VALEUR
# ════════════════════════════════════════════════════════════════════════════

def sample_confidence(home_matches: int, away_matches: int) -> dict:
    """Fiabilité de l'analyse selon la taille des échantillons.

    Sous ~6 matchs par équipe, les forces estimées sont trop bruitées pour
    parier : l'application doit le dire explicitement.
    """
    n = min(home_matches, away_matches)
    score = int(clamp(100 * (1 - math.exp(-n / 8.0)), 0, 100))
    if n == 0:
        label, advice = "AUCUNE DONNÉE", "Aucun historique : analyse purement indicative."
    elif n < 6:
        label, advice = "FAIBLE", "Échantillon trop court — ne pas miser sur ce modèle."
    elif n < 12:
        label, advice = "MOYENNE", "Échantillon limité — réduire la mise de moitié."
    elif n < 25:
        label, advice = "BONNE", "Échantillon suffisant pour une mise normale."
    else:
        label, advice = "ÉLEVÉE", "Échantillon solide."
    return {"score": score, "label": label, "advice": advice,
            "home_matches": home_matches, "away_matches": away_matches}


def find_value_bets(
    model_markets: Dict[str, Dict[str, float]],
    quotes: Sequence[dict],
    bankroll: float = 0.0,
    min_edge: float = 0.03,
    kelly_fraction: float = 0.25,
    kelly_cap: float = 0.05,
    market_weight: float = 0.35,
    devig_method: str = "odds_ratio",
    edge_haircut: float = DEFAULT_EDGE_HAIRCUT,
) -> List[dict]:
    """Compare les probabilités du modèle aux cotes disponibles.

    ``quotes`` : [{"market": "1X2", "selection": "HOME", "odds": 2.10,
                   "bookmaker": "X"}]

    Trois précautions, dans cet ordre :

    1. la marge du bookmaker est retirée du marché complet → probabilité
       « no-vig », c'est-à-dire l'avis réel du marché ;
    2. la probabilité retenue mêle modèle et marché (``market_weight``) : sur un
       marché liquide, le marché est le meilleur estimateur disponible ;
    3. l'edge obtenu subit une **décote** (``edge_haircut``) qui compense le
       biais de sélection : on ne garde que la meilleure sélection, or le
       maximum d'estimations bruitées est systématiquement trop optimiste.

    La mise de Kelly est calculée sur la probabilité *après* décote, jamais sur
    l'estimation brute. Retourne les sélections triées par edge net décroissant.
    """
    by_market: Dict[str, Dict[str, dict]] = {}
    for q in quotes:
        market = str(q.get("market") or "").strip()
        selection = str(q.get("selection") or "").strip().upper()
        odds = q.get("odds")
        if not market or not selection or not odds or float(odds) <= 1.0:
            continue
        current = by_market.setdefault(market, {}).get(selection)
        # On garde la meilleure cote disponible pour chaque sélection.
        if current is None or float(odds) > float(current["odds"]):
            by_market.setdefault(market, {})[selection] = {
                "odds": float(odds),
                "bookmaker": q.get("bookmaker"),
                "captured_at": q.get("captured_at"),
            }

    results: List[dict] = []
    for market, selections in by_market.items():
        model = model_markets.get(market) or {}
        if not model:
            continue
        novig = remove_margin({s: v["odds"] for s, v in selections.items()}, devig_method)
        margin = overround([v["odds"] for v in selections.values()])
        for selection, quote in selections.items():
            p_model = model.get(selection)
            if p_model is None:
                continue
            p_market = novig.get(selection)
            p_used = blend_probabilities(p_model, p_market, market_weight)
            raw_edge = edge(p_used, quote["odds"])
            if raw_edge is None:
                continue
            net_edge = raw_edge - max(0.0, edge_haircut)
            # Probabilité ramenée à ce que l'edge net implique : c'est elle qui
            # dimensionne la mise, jamais l'estimation brute.
            p_staking = max(0.0, (1.0 + net_edge) / float(quote["odds"]))
            stake = kelly_stake(p_staking, quote["odds"], bankroll, kelly_fraction, kelly_cap)
            results.append({
                "market": market,
                "selection": selection,
                "odds": quote["odds"],
                "bookmaker": quote["bookmaker"],
                "model_probability": round(p_model, 4),
                "market_probability": round(p_market, 4) if p_market is not None else None,
                "blended_probability": round(p_used, 4),
                "fair_odds": round(fair_odds(p_used), 3) if p_used > 0 else None,
                "edge_raw": round(raw_edge, 4),
                "edge_raw_pct": round(raw_edge * 100, 2),
                "haircut": round(max(0.0, edge_haircut), 4),
                "edge": round(net_edge, 4),
                "edge_pct": round(net_edge * 100, 2),
                "bookmaker_margin": round(margin, 4) if margin is not None else None,
                "kelly": stake,
                "is_value": net_edge >= min_edge,
            })

    results.sort(key=lambda r: r["edge"], reverse=True)
    return results


def build_verdict(
    markets: Dict[str, Dict[str, float]],
    confidence: dict,
    value_bets: Sequence[dict],
    min_edge: float = 0.03,
) -> dict:
    """Synthèse lisible : issue la plus probable, valeur retenue, alertes."""
    one_x_two = markets.get("1X2", {})
    ordered = sorted(one_x_two.items(), key=lambda kv: kv[1], reverse=True)
    top_outcome, top_prob = ordered[0] if ordered else (None, 0.0)
    expected = markets.get("_EXPECTED", {})
    ou25 = markets.get("OU_2.5", {})

    warnings: List[str] = []
    if confidence["label"] in ("AUCUNE DONNÉE", "FAIBLE"):
        warnings.append(confidence["advice"])
    if top_prob and top_prob < 0.40:
        warnings.append(
            "Match très ouvert (aucune issue au-dessus de 40 %) : privilégier "
            "les marchés buts ou la double chance."
        )
    if not value_bets:
        warnings.append("Aucune cote enregistrée : impossible de mesurer la valeur.")

    best = next((v for v in value_bets if v["is_value"]), None)
    if best is None and value_bets:
        haircut = value_bets[0].get("haircut") or 0.0
        warnings.append(
            f"Aucune sélection n'atteint le seuil de valeur de {min_edge * 100:.1f} % "
            f"après la décote de {haircut * 100:.1f} point(s) appliquée aux edges "
            "estimés — la meilleure décision est de ne pas parier."
        )

    return {
        "most_likely_outcome": top_outcome,
        "most_likely_probability": round(top_prob, 4),
        "expected_goals": {k: round(v, 3) for k, v in expected.items()},
        "goals_lean": (
            "OVER 2.5" if ou25.get("OVER", 0) > 0.55
            else "UNDER 2.5" if ou25.get("UNDER", 0) > 0.55
            else "NEUTRE"
        ),
        "recommended_bet": best,
        "action": "PARIER" if best else "PASSER",
        "confidence": confidence,
        "warnings": warnings,
    }


# ════════════════════════════════════════════════════════════════════════════
#  ANALYSE COMPLÈTE D'UN MATCH
# ════════════════════════════════════════════════════════════════════════════

def analyse_match(
    history: Sequence[MatchRecord],
    home_team: object,
    away_team: object,
    quotes: Sequence[dict] = (),
    bankroll: float = 0.0,
    reference: Optional[datetime] = None,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
    rho: float = DEFAULT_RHO,
    max_goals: int = DEFAULT_MAX_GOALS,
    min_edge: float = 0.03,
    kelly_fraction: float = 0.25,
    kelly_cap: float = 0.05,
    market_weight: float = 0.35,
    edge_haircut: float = DEFAULT_EDGE_HAIRCUT,
    home_boost: float = 1.0,
    away_boost: float = 1.0,
    form_window: int = 10,
) -> dict:
    """Analyse complète d'une affiche : le point d'entrée du module.

    Assemble forces d'équipe, buts attendus, grille de scores, probabilités de
    marché, forme, Elo, confrontations directes, paris de valeur et verdict.
    """
    strengths, baseline = team_strengths(
        history, reference=reference, half_life_days=half_life_days
    )
    home_st = strengths.get(home_team)
    away_st = strengths.get(away_team)

    lam_h, lam_a = expected_goals(home_st, away_st, baseline, home_boost, away_boost)
    grid = score_grid(lam_h, lam_a, max_goals=max_goals, rho=rho)
    markets = market_probabilities(grid)

    elo = elo_ratings(history)
    elo_h = elo.get(home_team, 1500.0)
    elo_a = elo.get(away_team, 1500.0)

    n_home = len(team_matches(history, home_team))
    n_away = len(team_matches(history, away_team))
    confidence = sample_confidence(n_home, n_away)

    value_bets = find_value_bets(
        markets, quotes, bankroll=bankroll, min_edge=min_edge,
        kelly_fraction=kelly_fraction, kelly_cap=kelly_cap,
        market_weight=market_weight, edge_haircut=edge_haircut,
    )

    return {
        "teams": {"home": home_team, "away": away_team},
        "baseline": baseline.as_dict(),
        "strengths": {
            "home": home_st.as_dict() if home_st else None,
            "away": away_st.as_dict() if away_st else None,
        },
        "expected_goals": {
            "home": round(lam_h, 3),
            "away": round(lam_a, 3),
            "total": round(lam_h + lam_a, 3),
            "supremacy": round(lam_h - lam_a, 3),
        },
        "markets": {
            k: ({s: round(p, 5) for s, p in v.items()} if k != "_EXPECTED"
                else {s: round(p, 4) for s, p in v.items()})
            for k, v in markets.items()
        },
        "fair_odds": {
            k: {s: (round(fair_odds(p), 3) if p > 0 else None) for s, p in v.items()}
            for k, v in markets.items() if k != "_EXPECTED"
        },
        # Grille tronquée pour l'affichage (carte de chaleur des scores) :
        # les cellules au-delà de 5 buts sont négligeables mais comptabilisées.
        "score_matrix": {
            "max_goals": min(5, max_goals),
            "rows": [
                [round(grid[i][j], 5) for j in range(min(6, max_goals + 1))]
                for i in range(min(6, max_goals + 1))
            ],
            "beyond": round(
                1.0 - sum(
                    grid[i][j]
                    for i in range(min(6, max_goals + 1))
                    for j in range(min(6, max_goals + 1))
                ),
                5,
            ),
        },
        "top_scores": [
            {**s, "probability": round(s["probability"], 5),
             "fair_odds": round(s["fair_odds"], 2) if s["fair_odds"] else None}
            for s in most_likely_scores(grid, top=6)
        ],
        "elo": {
            "home": round(elo_h, 1),
            "away": round(elo_a, 1),
            "diff": round(elo_h - elo_a, 1),
            "probabilities": {
                k: round(v, 4)
                for k, v in elo_probabilities(elo_h, elo_a).items()
            },
        },
        "form": {
            "home_overall": team_form(history, home_team, form_window),
            "home_at_home": team_form(history, home_team, form_window, venue="HOME"),
            "away_overall": team_form(history, away_team, form_window),
            "away_at_away": team_form(history, away_team, form_window, venue="AWAY"),
        },
        "head_to_head": head_to_head(history, home_team, away_team),
        "value_bets": value_bets,
        "verdict": build_verdict(markets, confidence, value_bets, min_edge),
    }


# ════════════════════════════════════════════════════════════════════════════
#  PERFORMANCE DU PARIEUR
# ════════════════════════════════════════════════════════════════════════════

def bet_performance(
    bets: Sequence[BetRecord],
    starting_bankroll: float = 0.0,
) -> dict:
    """Indicateurs de performance : ROI, yield, drawdown, CLV, par marché.

    - ``roi`` / ``yield`` : profit / total misé sur les paris réglés.
    - ``max_drawdown``    : pire recul depuis un sommet de bankroll ; c'est
      l'indicateur de risque le plus utile pour dimensionner ses mises.
    - ``clv``             : valeur prise sur la cote de clôture. Un CLV positif
      durable est le seul vrai signe d'un avantage réel.
    """
    settled = [b for b in bets if b.is_settled()]
    resolved = [b for b in settled if b.is_resolved_stake()]
    pending = [b for b in bets if not b.is_settled()]

    staked = sum(b.stake for b in resolved)
    profit = sum(b.net_profit() for b in settled)
    wins = sum(1 for b in resolved if b.net_profit() > 0)
    losses = sum(1 for b in resolved if b.net_profit() < 0)

    ordered = sorted(
        settled,
        key=lambda b: _as_utc(b.placed_at) or datetime.min.replace(tzinfo=timezone.utc),
    )
    equity = starting_bankroll
    peak = starting_bankroll
    max_dd = 0.0
    max_dd_pct = 0.0
    curve: List[dict] = [{"index": 0, "bankroll": round(equity, 2), "profit": 0.0}]
    running = 0.0
    losing_streak = worst_losing_streak = 0
    winning_streak = best_winning_streak = 0

    for i, b in enumerate(ordered, start=1):
        p = b.net_profit()
        running += p
        equity += p
        peak = max(peak, equity)
        dd = peak - equity
        if dd > max_dd:
            max_dd = dd
            max_dd_pct = (dd / peak * 100) if peak > 0 else 0.0
        if p < 0:
            losing_streak += 1
            winning_streak = 0
            worst_losing_streak = max(worst_losing_streak, losing_streak)
        elif p > 0:
            winning_streak += 1
            losing_streak = 0
            best_winning_streak = max(best_winning_streak, winning_streak)
        curve.append({
            "index": i,
            "date": b.placed_at.isoformat() if b.placed_at else None,
            "label": b.label or f"{b.market} {b.selection}",
            "profit": round(running, 2),
            "bankroll": round(equity, 2),
            "result": b.status,
        })

    clv_samples = [
        (b.closing_odds / b.odds - 1.0)
        for b in settled
        if b.closing_odds and b.odds and b.odds > 1.0
    ]
    edge_samples = [
        edge(b.model_prob, b.odds)
        for b in bets
        if b.model_prob and b.odds and b.odds > 1.0
    ]

    by_market: Dict[str, dict] = {}
    for b in resolved:
        row = by_market.setdefault(b.market or "?", {
            "market": b.market or "?", "bets": 0, "staked": 0.0, "profit": 0.0, "wins": 0,
        })
        row["bets"] += 1
        row["staked"] += b.stake
        row["profit"] += b.net_profit()
        if b.net_profit() > 0:
            row["wins"] += 1
    for row in by_market.values():
        row["roi"] = round(row["profit"] / row["staked"], 4) if row["staked"] else 0.0
        row["win_rate"] = round(row["wins"] / row["bets"], 3) if row["bets"] else 0.0
        row["staked"] = round(row["staked"], 2)
        row["profit"] = round(row["profit"], 2)

    return {
        "bets_total": len(bets),
        "bets_settled": len(settled),
        "bets_pending": len(pending),
        "pending_stake": round(sum(b.stake for b in pending), 2),
        "staked": round(staked, 2),
        "profit": round(profit, 2),
        "roi": round(profit / staked, 4) if staked else 0.0,
        "yield_pct": round(profit / staked * 100, 2) if staked else 0.0,
        "win_rate": round(wins / len(resolved), 3) if resolved else 0.0,
        "wins": wins,
        "losses": losses,
        "avg_stake": round(staked / len(resolved), 2) if resolved else 0.0,
        "avg_odds": round(sum(b.odds for b in resolved) / len(resolved), 3) if resolved else 0.0,
        "avg_expected_edge": round(sum(edge_samples) / len(edge_samples), 4) if edge_samples else None,
        "clv_avg_pct": round(sum(clv_samples) / len(clv_samples) * 100, 2) if clv_samples else None,
        "clv_beat_rate": round(sum(1 for c in clv_samples if c > 0) / len(clv_samples), 3) if clv_samples else None,
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "worst_losing_streak": worst_losing_streak,
        "best_winning_streak": best_winning_streak,
        "current_bankroll": round(equity, 2),
        "bankroll_curve": curve,
        "by_market": sorted(by_market.values(), key=lambda r: r["profit"], reverse=True),
    }


# ════════════════════════════════════════════════════════════════════════════
#  RÈGLEMENT AUTOMATIQUE DES PARIS
# ════════════════════════════════════════════════════════════════════════════

def settle_selection(
    market: str,
    selection: str,
    home_goals: int,
    away_goals: int,
) -> Optional[str]:
    """Résultat d'une sélection au vu du score final.

    Retourne ``WON``, ``LOST``, ``VOID`` (remboursé), ``HALF_WON`` ou
    ``HALF_LOST`` (handicaps en quart de but), ou ``None`` si le marché n'est
    pas reconnu — dans ce cas le pari doit être réglé à la main.
    """
    market = (market or "").strip().upper()
    selection = (selection or "").strip().upper()
    hg, ag = int(home_goals), int(away_goals)
    total = hg + ag
    margin = hg - ag

    def verdict(won: bool) -> str:
        return "WON" if won else "LOST"

    if market == "1X2":
        if selection not in ("HOME", "DRAW", "AWAY"):
            return None
        outcome = "HOME" if margin > 0 else "AWAY" if margin < 0 else "DRAW"
        return verdict(selection == outcome)

    if market == "DOUBLE_CHANCE":
        outcome = "HOME" if margin > 0 else "AWAY" if margin < 0 else "DRAW"
        mapping = {
            "1X": ("HOME", "DRAW"),
            "12": ("HOME", "AWAY"),
            "X2": ("DRAW", "AWAY"),
        }
        if selection not in mapping:
            return None
        return verdict(outcome in mapping[selection])

    if market == "BTTS":
        both = hg > 0 and ag > 0
        if selection == "YES":
            return verdict(both)
        if selection == "NO":
            return verdict(not both)
        return None

    if market == "ODD_EVEN":
        odd = total % 2 == 1
        if selection == "ODD":
            return verdict(odd)
        if selection == "EVEN":
            return verdict(not odd)
        return None

    if market == "CLEAN_SHEET":
        if selection == "HOME":
            return verdict(ag == 0)
        if selection == "AWAY":
            return verdict(hg == 0)
        return None

    if market == "TO_SCORE":
        if selection == "HOME":
            return verdict(hg > 0)
        if selection == "AWAY":
            return verdict(ag > 0)
        return None

    if market == "WIN_TO_NIL":
        if selection == "HOME":
            return verdict(hg > 0 and ag == 0)
        if selection == "AWAY":
            return verdict(ag > 0 and hg == 0)
        return None

    if market == "CORRECT_SCORE":
        parts = selection.split("-")
        if len(parts) != 2 or not all(part.strip().isdigit() for part in parts):
            return None
        return verdict(selection.replace(" ", "") == f"{hg}-{ag}")

    if market.startswith("OU_") or market.startswith("HOME_OU_") or market.startswith("AWAY_OU_"):
        try:
            line = float(market.rsplit("_", 1)[1])
        except (ValueError, IndexError):
            return None
        value = total
        if market.startswith("HOME_OU_"):
            value = hg
        elif market.startswith("AWAY_OU_"):
            value = ag
        if abs(value - line) < 1e-9:
            return "VOID"
        if selection == "OVER":
            return verdict(value > line)
        if selection == "UNDER":
            return verdict(value < line)
        return None

    if market.startswith("AH_"):
        try:
            line = float(market.split("_", 1)[1])
        except (ValueError, IndexError):
            return None
        if selection not in ("HOME", "AWAY"):
            return None
        # Ligne en quart de but : la mise est scindée sur les deux demi-lignes.
        if round(abs(line) * 4) % 2 == 1:
            first = settle_selection(f"AH_{line - 0.25}", selection, hg, ag)
            second = settle_selection(f"AH_{line + 0.25}", selection, hg, ag)
            outcomes = {first, second}
            if outcomes == {"WON"}:
                return "WON"
            if outcomes == {"LOST"}:
                return "LOST"
            if "WON" in outcomes and "VOID" in outcomes:
                return "HALF_WON"
            if "LOST" in outcomes and "VOID" in outcomes:
                return "HALF_LOST"
            return "VOID"
        adjusted = margin + line if selection == "HOME" else -margin - line
        if abs(adjusted) < 1e-9:
            return "VOID"
        return verdict(adjusted > 0)

    return None
