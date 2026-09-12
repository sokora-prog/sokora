"""
SOKORA SPORT — Calibration, significativité et risque (hypothèses réalistes)

Ce module part de l'hypothèse inverse de celle d'un modèle naïf :

    Par défaut, le marché a raison. C'est au modèle de prouver, chiffres en
    main, qu'il apporte une information que la cote de clôture ne contient pas.

Tant que cette preuve n'est pas faite, l'application doit conseiller de ne pas
parier — quel que soit l'« edge » que le modèle croit voir.

Trois familles d'outils, toutes en Python standard :

1. CALIBRATION — le modèle est-il meilleur que le marché ?
   Score de Brier et log-loss du modèle *contre* ceux de la cote de clôture
   débarrassée de sa marge, skill score, courbe de fiabilité, et poids optimal
   du marché déduit des données plutôt que choisi à la main.

2. SIGNIFICATIVITÉ — le résultat observé prouve-t-il quelque chose ?
   Test sur le yield et sur le CLV, intervalle de confiance, et surtout le
   nombre de paris qu'il faudrait pour trancher.

3. RISQUE — que se passe-t-il si l'avantage est réel mais petit ?
   Simulation de Monte-Carlo de la stratégie : distribution du capital final,
   probabilité de finir en perte, de subir un recul de 20 % ou 30 %.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

# Probabilité minimale utilisée dans les logarithmes (évite log(0)).
EPSILON = 1e-6

#: Seuil de skill score au-delà duquel on considère que le modèle apporte
#: réellement de l'information. 1 % de mieux que le marché est déjà beaucoup.
SKILL_THRESHOLD = 0.005

#: Nombre de paris en dessous duquel aucun résultat n'est concluant.
MIN_BETS_FOR_CONCLUSION = 100


# ════════════════════════════════════════════════════════════════════════════
#  STRUCTURES
# ════════════════════════════════════════════════════════════════════════════

@dataclass
class ForecastRecord:
    """Une prévision passée, confrontée au marché puis au résultat réel.

    `model` et `market` contiennent des probabilités par sélection, sommant à 1
    chacune. `winner` est la sélection réellement gagnante.
    """
    market_key: str
    model: Dict[str, float]
    market: Dict[str, float]
    winner: str
    odds: Dict[str, float] = field(default_factory=dict)
    kickoff: Optional[datetime] = None
    label: str = ""
    #: Métadonnées de segmentation, pour savoir *où* se situe un avantage.
    competition: Optional[object] = None
    expected_total: Optional[float] = None

    @property
    def favourite_probability(self) -> float:
        """Probabilité de l'issue la plus probable selon le marché."""
        return max(self.market.values()) if self.market else 0.0

    def blended(self, market_weight: float) -> Dict[str, float]:
        w = min(1.0, max(0.0, market_weight))
        keys = set(self.model) | set(self.market)
        return {
            k: (1.0 - w) * self.model.get(k, 0.0) + w * self.market.get(k, 0.0)
            for k in keys
        }


# ════════════════════════════════════════════════════════════════════════════
#  OUTILS STATISTIQUES DE BASE
# ════════════════════════════════════════════════════════════════════════════

def normal_cdf(z: float) -> float:
    """Fonction de répartition de la loi normale centrée réduite."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def two_sided_p_value(z: float) -> float:
    """p-valeur bilatérale d'un score z."""
    return 2.0 * (1.0 - normal_cdf(abs(z)))


def mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def stdev(values: Sequence[float]) -> float:
    """Écart-type d'échantillon (n − 1)."""
    n = len(values)
    if n < 2:
        return 0.0
    m = mean(values)
    return math.sqrt(sum((v - m) ** 2 for v in values) / (n - 1))


# ════════════════════════════════════════════════════════════════════════════
#  1. CALIBRATION — LE MODÈLE BAT-IL LE MARCHÉ ?
# ════════════════════════════════════════════════════════════════════════════

def brier_score(records: Sequence[ForecastRecord], source: str = "model") -> Optional[float]:
    """Score de Brier multi-classes : moyenne des écarts quadratiques.

    0 = prévision parfaite. Plus bas est meilleur. C'est une *règle de score
    propre* : on ne peut pas l'améliorer en mentant sur ses probabilités.
    """
    if not records:
        return None
    total = 0.0
    for record in records:
        probabilities = getattr(record, source)
        for selection, p in probabilities.items():
            outcome = 1.0 if selection == record.winner else 0.0
            total += (p - outcome) ** 2
    return total / len(records)


def log_loss(records: Sequence[ForecastRecord], source: str = "model") -> Optional[float]:
    """Log-loss : pénalise très durement les certitudes erronées."""
    if not records:
        return None
    total = 0.0
    for record in records:
        probabilities = getattr(record, source)
        p = max(EPSILON, probabilities.get(record.winner, 0.0))
        total -= math.log(p)
    return total / len(records)


def blended_log_loss(records: Sequence[ForecastRecord], market_weight: float) -> float:
    """Log-loss d'un mélange modèle / marché à poids donné."""
    if not records:
        return float("inf")
    total = 0.0
    for record in records:
        p = max(EPSILON, record.blended(market_weight).get(record.winner, 0.0))
        total -= math.log(p)
    return total / len(records)


def skill_score(model_metric: Optional[float], reference_metric: Optional[float]) -> Optional[float]:
    """Gain relatif du modèle sur une référence (ici : le marché).

    Positif = le modèle fait mieux. 0 = strictement équivalent.
    Négatif = le marché est meilleur, ce qui est le cas le plus fréquent.
    """
    if model_metric is None or not reference_metric:
        return None
    return 1.0 - model_metric / reference_metric


def optimal_market_weight(
    records: Sequence[ForecastRecord],
    step: float = 0.01,
) -> Optional[float]:
    """Poids du marché qui minimise la log-loss sur l'historique.

    C'est le cœur de l'approche réaliste : ce nombre n'est pas choisi, il est
    mesuré. S'il vaut 1,00, le modèle n'apporte rien et doit être ignoré ;
    s'il vaut 0,70, le modèle mérite 30 % de voix au chapitre.
    """
    if not records:
        return None
    best_weight, best_loss = 1.0, float("inf")
    steps = int(round(1.0 / step))
    for i in range(steps + 1):
        weight = i * step
        loss = blended_log_loss(records, weight)
        if loss < best_loss - 1e-12:
            best_loss, best_weight = loss, weight
    return best_weight


def reliability_bins(
    records: Sequence[ForecastRecord],
    source: str = "model",
    bin_count: int = 10,
) -> List[dict]:
    """Courbe de fiabilité : « quand j'annonce 30 %, cela arrive-t-il 30 % du temps ? »

    Chaque probabilité annoncée est rangée dans un intervalle ; on compare la
    moyenne annoncée à la fréquence réellement observée.
    """
    buckets: List[dict] = [
        {
            "bin": i,
            "lower": i / bin_count,
            "upper": (i + 1) / bin_count,
            "count": 0,
            "sum_predicted": 0.0,
            "hits": 0,
        }
        for i in range(bin_count)
    ]
    for record in records:
        for selection, p in getattr(record, source).items():
            index = min(bin_count - 1, max(0, int(p * bin_count)))
            bucket = buckets[index]
            bucket["count"] += 1
            bucket["sum_predicted"] += p
            if selection == record.winner:
                bucket["hits"] += 1

    out = []
    for bucket in buckets:
        if bucket["count"] == 0:
            continue
        predicted = bucket["sum_predicted"] / bucket["count"]
        observed = bucket["hits"] / bucket["count"]
        # Erreur type d'une fréquence binomiale, pour savoir si l'écart compte.
        error = math.sqrt(max(observed * (1 - observed), 1e-9) / bucket["count"])
        out.append({
            "lower": round(bucket["lower"], 3),
            "upper": round(bucket["upper"], 3),
            "count": bucket["count"],
            "predicted": round(predicted, 4),
            "observed": round(observed, 4),
            "gap": round(observed - predicted, 4),
            "std_error": round(error, 4),
            "within_noise": abs(observed - predicted) <= 2 * error,
        })
    return out


def calibration_report(records: Sequence[ForecastRecord]) -> dict:
    """Verdict complet : le modèle mérite-t-il qu'on lui fasse confiance ?"""
    n = len(records)
    if n == 0:
        return {
            "sample": 0,
            "verdict": "AUCUNE DONNÉE",
            "conclusive": False,
            "message": (
                "Aucune prévision confrontée à une cote. Enregistrez les cotes de "
                "vos matchs joués pour que le modèle puisse être jugé."
            ),
            "recommended_market_weight": 1.0,
        }

    brier_model = brier_score(records, "model")
    brier_market = brier_score(records, "market")
    loss_model = log_loss(records, "model")
    loss_market = log_loss(records, "market")
    brier_skill = skill_score(brier_model, brier_market)
    loss_skill = skill_score(loss_model, loss_market)
    weight = optimal_market_weight(records)
    blended_loss = blended_log_loss(records, weight if weight is not None else 1.0)

    conclusive = n >= MIN_BETS_FOR_CONCLUSION
    beats_market = (brier_skill or 0) > SKILL_THRESHOLD and (loss_skill or 0) > 0

    if not conclusive:
        verdict = "ÉCHANTILLON INSUFFISANT"
        message = (
            f"{n} prévisions seulement : trop peu pour distinguer un modèle "
            f"informatif d'une série chanceuse. Il en faut au moins "
            f"{MIN_BETS_FOR_CONCLUSION}. En attendant, suivre le marché."
        )
        recommended = 1.0
    elif beats_market:
        verdict = "MODÈLE INFORMATIF"
        message = (
            f"Le modèle bat la cote de clôture de {brier_skill * 100:.2f} % au "
            f"score de Brier sur {n} prévisions. Poids du modèle justifié : "
            f"{(1 - (weight or 1)) * 100:.0f} %."
        )
        recommended = weight if weight is not None else 1.0
    else:
        verdict = "PAS MIEUX QUE LE MARCHÉ"
        message = (
            f"Sur {n} prévisions, le modèle ne fait pas mieux que la cote de "
            f"clôture (skill score {(brier_skill or 0) * 100:.2f} %). L'hypothèse "
            f"réaliste est donc que tout « edge » affiché est du bruit : "
            f"s'aligner sur le marché et ne pas parier ces marchés."
        )
        recommended = 1.0

    return {
        "sample": n,
        "brier_model": round(brier_model, 5) if brier_model is not None else None,
        "brier_market": round(brier_market, 5) if brier_market is not None else None,
        "brier_skill_score": round(brier_skill, 5) if brier_skill is not None else None,
        "log_loss_model": round(loss_model, 5) if loss_model is not None else None,
        "log_loss_market": round(loss_market, 5) if loss_market is not None else None,
        "log_loss_skill_score": round(loss_skill, 5) if loss_skill is not None else None,
        "optimal_market_weight": round(weight, 3) if weight is not None else None,
        "blended_log_loss": round(blended_loss, 5),
        "recommended_market_weight": round(recommended, 3),
        "beats_market": bool(beats_market and conclusive),
        "conclusive": conclusive,
        "verdict": verdict,
        "message": message,
        "reliability_model": reliability_bins(records, "model"),
        "reliability_market": reliability_bins(records, "market"),
    }


# ════════════════════════════════════════════════════════════════════════════
#  2. SIGNIFICATIVITÉ — LE RÉSULTAT PROUVE-T-IL QUELQUE CHOSE ?
# ════════════════════════════════════════════════════════════════════════════

def significance_test(returns: Sequence[float], label: str = "yield") -> dict:
    """Test de significativité sur une série de rendements unitaires.

    `returns` : profit par euro misé, pari par pari (+1.4 pour un gain à 2.40,
    −1.0 pour une perte). On teste l'hypothèse « rendement moyen nul ».
    """
    n = len(returns)
    if n < 2:
        return {
            "sample": n, "mean": None, "std_dev": None, "t_stat": None,
            "p_value": None, "confidence_interval": None, "significant": False,
            "message": "Trop peu de paris pour un test.",
        }

    m = mean(returns)
    s = stdev(returns)
    # Une série constante donne un écart-type de l'ordre de 1e-17 plutôt que 0
    # exactement : sans ce seuil, le t de Student explose et l'on conclurait à
    # une significativité parfaite sur des données qui ne varient pas.
    if s <= max(1e-12, abs(m) * 1e-9):
        return {
            "sample": n, "mean": round(m, 5), "std_dev": 0.0, "t_stat": None,
            "p_value": None, "confidence_interval": None, "significant": False,
            "message": "Variance nulle : test impossible.",
        }

    standard_error = s / math.sqrt(n)
    t_stat = m / standard_error
    p_value = two_sided_p_value(t_stat)
    low = m - 1.96 * standard_error
    high = m + 1.96 * standard_error
    significant = p_value < 0.05

    if significant and m > 0:
        message = (
            f"Rendement moyen de {m * 100:.2f} % significatif (p = {p_value:.3f}) : "
            "un avantage réel est plausible, sans être prouvé."
        )
    elif significant and m < 0:
        message = (
            f"Perte moyenne de {abs(m) * 100:.2f} % significative (p = {p_value:.3f}) : "
            "la stratégie détruit du capital, il faut l'arrêter."
        )
    else:
        message = (
            f"Rendement moyen de {m * 100:.2f} % non significatif (p = {p_value:.3f}) : "
            "indistinguable du hasard. L'intervalle de confiance contient zéro."
        )

    return {
        "sample": n,
        "mean": round(m, 5),
        "mean_pct": round(m * 100, 3),
        "std_dev": round(s, 5),
        "t_stat": round(t_stat, 3),
        "p_value": round(p_value, 5),
        "confidence_interval": [round(low * 100, 3), round(high * 100, 3)],
        "significant": significant,
        "message": message,
    }


def required_sample_size(
    edge: float,
    odds: float,
    confidence: float = 0.95,
    power: float = 0.80,
) -> Optional[int]:
    """Nombre de paris nécessaires pour détecter un avantage donné.

    C'est le chiffre qui remet la plupart des parieurs à leur place : détecter
    un edge de 2 % à cote 2,00 demande plusieurs milliers de paris.
    """
    if edge <= 0 or odds <= 1.0:
        return None
    # Probabilité implicite d'un pari d'espérance (1 + edge) à cette cote.
    p = (1.0 + edge) / odds
    if not 0 < p < 1:
        return None
    variance = p * (1 - p) * odds ** 2
    z_alpha = 1.959963985 if confidence >= 0.95 else 1.644853627
    z_beta = 0.841621234 if power >= 0.80 else 0.524400513
    n = ((z_alpha + z_beta) ** 2) * variance / (edge ** 2)
    return int(math.ceil(n))


def clv_summary(clv_values: Sequence[float]) -> dict:
    """Analyse du CLV, l'indicateur qui répond le plus vite.

    `clv_values` : (cote_prise / cote_clôture − 1), pari par pari.
    """
    if not clv_values:
        return {
            "sample": 0, "mean_pct": None, "beat_rate": None,
            "significant": False,
            "message": (
                "Aucune cote de clôture enregistrée. C'est pourtant la mesure la "
                "plus rapide : elle conclut en quelques dizaines de paris là où "
                "le ROI en demande des milliers."
            ),
        }
    test = significance_test(list(clv_values), "clv")
    beat_rate = sum(1 for v in clv_values if v > 0) / len(clv_values)
    average = mean(clv_values)
    if test["significant"] and average > 0:
        message = (
            f"CLV moyen de {average * 100:.2f} % significativement positif : "
            "vous prenez systématiquement de meilleures cotes que la clôture, "
            "ce qui est le signe le plus fiable d'un avantage réel."
        )
    elif average == 0:
        message = (
            "CLV exactement nul : les cotes relevées n'ont pas bougé entre la "
            "prise et la clôture. Rien à en conclure — l'indicateur ne devient "
            "informatif que si les deux relevés sont faits à des moments "
            "différents."
        )
    elif average < 0:
        message = (
            f"CLV moyen de {average * 100:.2f} % : vous pariez à des cotes moins "
            "bonnes que la clôture. Sur la durée, cela suffit à expliquer une "
            "perte, même avec un modèle correct."
        )
    else:
        message = (
            f"CLV moyen de {average * 100:.2f} %, encore non significatif sur "
            f"{len(clv_values)} paris. À surveiller en priorité."
        )
    return {
        "sample": len(clv_values),
        "mean_pct": round(average * 100, 3),
        "beat_rate": round(beat_rate, 3),
        "t_stat": test["t_stat"],
        "p_value": test["p_value"],
        "significant": bool(test["significant"] and average > 0),
        "message": message,
    }


# ════════════════════════════════════════════════════════════════════════════
#  3. RISQUE — SIMULATION DE MONTE-CARLO
# ════════════════════════════════════════════════════════════════════════════

def simulate_strategy(
    n_bets: int = 500,
    odds: float = 2.0,
    true_edge: float = 0.02,
    believed_edge: Optional[float] = None,
    bankroll: float = 1000.0,
    staking: str = "kelly",
    kelly_fraction: float = 0.25,
    kelly_cap: float = 0.05,
    flat_stake_pct: float = 0.01,
    n_paths: int = 2000,
    seed: int = 20260910,
) -> dict:
    """Simule la stratégie un grand nombre de fois.

    Une seule trajectoire ne dit rien : c'est la *distribution* des résultats
    qui informe. Même avec un avantage réel de 2 %, une proportion importante
    des trajectoires finit en perte sur 500 paris.

    Deux avantages distincts, et c'est tout l'intérêt de la simulation :

    - ``believed_edge`` : celui que le modèle croit avoir. Il **dimensionne la
      mise**.
    - ``true_edge`` : celui réellement détenu. Il **détermine les résultats**.

    Le scénario le plus instructif est celui où l'on croit avoir 3 % et où l'on
    a en réalité −2 % : les mises restent confiantes pendant que le capital
    fond. C'est la situation par défaut d'un parieur dont le modèle n'a jamais
    été calibré.
    """
    n_bets = max(1, min(n_bets, 5000))
    n_paths = max(50, min(n_paths, 20000))
    if believed_edge is None:
        believed_edge = true_edge
    probability = (1.0 + true_edge) / odds
    probability = min(0.99, max(0.01, probability))
    believed_probability = min(0.99, max(0.01, (1.0 + believed_edge) / odds))

    rng = random.Random(seed)
    finals: List[float] = []
    drawdowns: List[float] = []
    losing_paths = 0
    ruined = 0
    sample_path: List[float] = []

    # La mise se calcule sur ce que l'on croit détenir, jamais sur la vérité.
    kelly_full = max(0.0, (believed_probability * odds - 1.0) / (odds - 1.0))
    stake_pct = (
        min(kelly_full * kelly_fraction, kelly_cap) if staking == "kelly"
        else flat_stake_pct
    )

    for path in range(n_paths):
        capital = bankroll
        peak = bankroll
        worst = 0.0
        track = [capital] if path == 0 else None
        for _ in range(n_bets):
            stake = capital * stake_pct if staking == "kelly" else bankroll * stake_pct
            stake = min(stake, capital)
            if stake <= 0:
                break
            if rng.random() < probability:
                capital += stake * (odds - 1.0)
            else:
                capital -= stake
            peak = max(peak, capital)
            worst = max(worst, (peak - capital) / peak if peak > 0 else 0.0)
            if track is not None:
                track.append(capital)
            if capital <= bankroll * 0.05:
                ruined += 1
                break
        finals.append(capital)
        drawdowns.append(worst)
        if capital < bankroll:
            losing_paths += 1
        if track is not None:
            sample_path = track

    finals.sort()

    def percentile(values: List[float], q: float) -> float:
        if not values:
            return 0.0
        index = min(len(values) - 1, max(0, int(round(q * (len(values) - 1)))))
        return values[index]

    sorted_drawdowns = sorted(drawdowns)
    median_final = percentile(finals, 0.5)

    return {
        "assumptions": {
            "n_bets": n_bets,
            "odds": odds,
            "true_edge": true_edge,
            "true_edge_pct": round(true_edge * 100, 2),
            "believed_edge": believed_edge,
            "believed_edge_pct": round(believed_edge * 100, 2),
            "win_probability": round(probability, 4),
            "staking": staking,
            "stake_pct": round(stake_pct, 4),
            "kelly_fraction": kelly_fraction,
            "bankroll": bankroll,
            "n_paths": n_paths,
        },
        "final_bankroll": {
            "p05": round(percentile(finals, 0.05), 2),
            "p25": round(percentile(finals, 0.25), 2),
            "median": round(median_final, 2),
            "p75": round(percentile(finals, 0.75), 2),
            "p95": round(percentile(finals, 0.95), 2),
            "mean": round(mean(finals), 2),
        },
        "probability_of_loss": round(losing_paths / n_paths, 4),
        "probability_of_ruin": round(ruined / n_paths, 4),
        "drawdown": {
            "median_pct": round(percentile(sorted_drawdowns, 0.5) * 100, 2),
            "p90_pct": round(percentile(sorted_drawdowns, 0.9) * 100, 2),
            "worst_pct": round(sorted_drawdowns[-1] * 100, 2) if sorted_drawdowns else 0.0,
            "over_20pct": round(sum(1 for d in drawdowns if d > 0.20) / n_paths, 4),
            "over_30pct": round(sum(1 for d in drawdowns if d > 0.30) / n_paths, 4),
        },
        "histogram": histogram(finals, bankroll),
        "sample_path": [round(v, 2) for v in sample_path[:: max(1, len(sample_path) // 120)]],
        "message": _simulation_message(
            true_edge, believed_edge, stake_pct,
            losing_paths / n_paths, median_final, bankroll, n_bets,
        ),
    }


def histogram(values: List[float], reference: float, bin_count: int = 24) -> List[dict]:
    """Répartition des capitaux finaux, pour visualiser l'étalement réel."""
    if not values:
        return []
    low, high = values[0], values[-1]
    if high <= low:
        return [{"lower": low, "upper": high, "count": len(values), "above_start": low >= reference}]
    width = (high - low) / bin_count
    bins = [
        {"lower": low + i * width, "upper": low + (i + 1) * width, "count": 0}
        for i in range(bin_count)
    ]
    for value in values:
        index = min(bin_count - 1, int((value - low) / width))
        bins[index]["count"] += 1
    for b in bins:
        b["lower"] = round(b["lower"], 2)
        b["upper"] = round(b["upper"], 2)
        b["above_start"] = b["lower"] >= reference
    return bins


def _simulation_message(
    true_edge: float, believed_edge: float, stake_pct: float,
    loss_probability: float, median_final: float, bankroll: float, n_bets: int,
) -> str:
    growth = (median_final / bankroll - 1.0) * 100 if bankroll else 0.0
    if stake_pct <= 0:
        return (
            "Avec l'avantage supposé, le critère de Kelly conseille une mise "
            "nulle : la stratégie consiste à ne pas parier, et le capital reste "
            "intact. C'est la bonne réponse quand aucun avantage n'est démontré."
        )
    if true_edge <= 0 < believed_edge:
        return (
            f"Vous misez {stake_pct * 100:.2f} % du capital en croyant détenir "
            f"{believed_edge * 100:.1f} % d'avantage, alors que l'avantage réel est "
            f"de {true_edge * 100:.1f} %. Résultat : {loss_probability * 100:.0f} % des "
            f"trajectoires perdent, la médiane termine à {growth:+.1f} %. C'est le "
            "scénario par défaut d'un modèle jamais calibré — l'erreur ne se voit "
            "pas dans les mises, seulement dans le capital."
        )
    if true_edge <= 0:
        return (
            "Sans avantage réel, la marge du bookmaker fait le reste : "
            f"{loss_probability * 100:.0f} % des trajectoires finissent en perte et "
            "l'espérance est négative, quelle que soit la gestion de mise."
        )
    return (
        f"Avec un avantage réel de {true_edge * 100:.1f} % sur {n_bets} paris, la "
        f"trajectoire médiane gagne {growth:.1f} %, mais {loss_probability * 100:.0f} % "
        "des trajectoires finissent tout de même en perte. Un résultat négatif "
        "sur cette durée ne prouve donc pas que la méthode est mauvaise — ni un "
        "résultat positif qu'elle est bonne."
    )


# ════════════════════════════════════════════════════════════════════════════
#  CARTE DES AVANTAGES — OÙ, PRÉCISÉMENT ?
# ════════════════════════════════════════════════════════════════════════════
#
# Personne n'a d'avantage partout. Un modèle peut être inutile sur les grosses
# affiches d'un championnat très couvert et apporter quelque chose sur les
# matchs serrés d'une division mineure. Mesurer globalement noie ces poches ;
# les segmenter les fait apparaître — au prix d'un piège qu'il faut nommer :
# à force de découper, une poche finit toujours par sembler gagnante par pur
# hasard. D'où l'exigence d'effectif minimal et le rappel du nombre de
# comparaisons effectuées.

#: Effectif en dessous duquel une poche n'est même pas affichée comme candidate.
MIN_SEGMENT_SAMPLE = 60


def segment_skill(records: Sequence[ForecastRecord]) -> dict:
    """Résultat d'un segment : le modèle y bat-il le marché ?"""
    n = len(records)
    brier_model = brier_score(records, "model")
    brier_market = brier_score(records, "market")
    skill = skill_score(brier_model, brier_market)

    # Écart de score match par match : permet de tester si l'avantage observé
    # tient du hasard, ce qu'un simple skill score ne dit pas.
    differences = []
    for record in records:
        model_error = sum(
            (p - (1.0 if sel == record.winner else 0.0)) ** 2
            for sel, p in record.model.items()
        )
        market_error = sum(
            (p - (1.0 if sel == record.winner else 0.0)) ** 2
            for sel, p in record.market.items()
        )
        differences.append(market_error - model_error)  # > 0 = modèle meilleur

    test = significance_test(differences) if n >= 2 else None
    reliable = n >= MIN_SEGMENT_SAMPLE
    beats = bool(
        reliable and skill is not None and skill > SKILL_THRESHOLD
        and test and test["significant"] and test["mean"] > 0
    )

    return {
        "sample": n,
        "brier_model": round(brier_model, 5) if brier_model is not None else None,
        "brier_market": round(brier_market, 5) if brier_market is not None else None,
        "skill_score": round(skill, 5) if skill is not None else None,
        "skill_pct": round(skill * 100, 2) if skill is not None else None,
        "p_value": test["p_value"] if test else None,
        "significant": bool(test and test["significant"]) if test else False,
        "reliable_sample": reliable,
        "beats_market": beats,
        "status": (
            "AVANTAGE ÉTAYÉ" if beats
            else "ÉCHANTILLON TROP COURT" if not reliable
            else "PAS D'AVANTAGE"
        ),
    }


def edge_map(
    records: Sequence[ForecastRecord],
    competition_names: Optional[Dict[object, str]] = None,
) -> dict:
    """Découpe l'échantillon en poches et cherche où le modèle tient debout.

    Trois découpages, choisis parce qu'ils correspondent à des décisions réelles
    du parieur : sur quelle compétition jouer, sur quel marché, et sur quel type
    d'affiche.
    """
    names = competition_names or {}

    def bucket_by(key_of) -> List[dict]:
        groups: Dict[object, List[ForecastRecord]] = {}
        for record in records:
            key = key_of(record)
            if key is None:
                continue
            groups.setdefault(key, []).append(record)
        rows = [
            {"segment": str(key), **segment_skill(group)}
            for key, group in groups.items()
        ]
        rows.sort(key=lambda r: (r["skill_score"] or -1), reverse=True)
        return rows

    def affiche(record: ForecastRecord) -> Optional[str]:
        """Type d'affiche selon ce que le marché en dit."""
        top = record.favourite_probability
        if not top:
            return None
        if top >= 0.60:
            return "Favori net (marché ≥ 60 %)"
        if top >= 0.45:
            return "Favori modéré (45–60 %)"
        return "Affiche ouverte (< 45 %)"

    def total_bucket(record: ForecastRecord) -> Optional[str]:
        if record.expected_total is None:
            return None
        if record.expected_total >= 3.0:
            return "Match attendu prolifique (≥ 3 buts)"
        if record.expected_total >= 2.4:
            return "Total attendu moyen (2,4–3)"
        return "Match attendu fermé (< 2,4 buts)"

    segments = {
        "par_competition": bucket_by(
            lambda r: names.get(r.competition, str(r.competition))
            if r.competition is not None else None
        ),
        "par_marche": bucket_by(lambda r: r.market_key),
        "par_affiche": bucket_by(affiche),
        "par_total_attendu": bucket_by(total_bucket),
    }

    comparisons = sum(len(rows) for rows in segments.values())
    winners = [
        {"famille": family, **row}
        for family, rows in segments.items()
        for row in rows if row["beats_market"]
    ]
    winners.sort(key=lambda r: r["skill_score"], reverse=True)

    if not records:
        message = "Aucune prévision cotée : rien à segmenter."
    elif winners:
        best = winners[0]
        message = (
            f"{len(winners)} poche(s) où le modèle bat le marché, la meilleure "
            f"étant « {best['segment']} » ({best['skill_pct']:+.2f} % de skill sur "
            f"{best['sample']} prévisions, p = {best['p_value']}). Attention : "
            f"{comparisons} segments ont été testés — plus on découpe, plus une "
            "poche gagnante par hasard devient probable. À confirmer sur des "
            "données nouvelles avant d'y engager de l'argent."
        )
    else:
        message = (
            f"Aucune poche ne montre d'avantage étayé sur les {comparisons} segments "
            f"testés. C'est le résultat le plus fréquent, et il a le mérite d'être "
            "clair : il n'y a rien à exploiter ici pour l'instant."
        )

    return {
        "sample": len(records),
        "segments": segments,
        "winners": winners,
        "comparisons": comparisons,
        "min_segment_sample": MIN_SEGMENT_SAMPLE,
        "message": message,
    }


# ════════════════════════════════════════════════════════════════════════════
#  SYNTHÈSE
# ════════════════════════════════════════════════════════════════════════════

def realism_summary(
    calibration: dict,
    yield_test: dict,
    clv: dict,
) -> dict:
    """Ce que l'on peut honnêtement affirmer, et ce qui reste à prouver."""
    established: List[str] = []
    unproven: List[str] = []
    actions: List[str] = []

    if calibration.get("beats_market"):
        established.append(
            f"Le modèle bat la cote de clôture sur {calibration['sample']} prévisions."
        )
        actions.append(
            f"Utiliser un poids marché de {calibration['recommended_market_weight']:.2f} "
            "plutôt que la valeur par défaut."
        )
    elif calibration.get("sample", 0) > 0:
        unproven.append(calibration.get("message", ""))
        actions.append(
            "Ne pas parier sur la foi du modèle seul : s'aligner sur le marché "
            "tant que la calibration ne montre pas d'avantage."
        )
    else:
        unproven.append(
            "La qualité du modèle n'a jamais été mesurée faute de cotes historiques."
        )
        actions.append(
            "Enregistrer les cotes de clôture des matchs joués : c'est le seul "
            "moyen de savoir si le modèle vaut quelque chose."
        )

    if yield_test.get("significant") and (yield_test.get("mean") or 0) > 0:
        established.append(yield_test["message"])
    elif yield_test.get("sample", 0) > 0:
        unproven.append(yield_test.get("message", ""))

    if clv.get("significant"):
        established.append(clv["message"])
    elif clv.get("sample", 0) > 0:
        unproven.append(clv.get("message", ""))
    else:
        actions.append(
            "Saisir la cote de clôture à chaque règlement de pari : le CLV "
            "conclut bien plus vite que le ROI."
        )

    if not established:
        headline = "Aucun avantage démontré à ce jour"
        stance = "SUIVRE LE MARCHÉ"
    else:
        headline = "Avantage partiellement étayé"
        stance = "MISER PRUDEMMENT"

    return {
        "headline": headline,
        "stance": stance,
        "established": established,
        "unproven": [u for u in unproven if u],
        "actions": actions,
    }
