"""
Tests de la couche « hypothèses réalistes » : calibration face au marché,
significativité statistique et simulation de risque.

    cd backend && python3 -m unittest discover -s tests -v
"""

import math
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import calibration_sport as cal  # noqa: E402


def sample_truth(rng):
    """Une vraie distribution 1X2 tirée au hasard."""
    a, b, c = rng.random() + 0.2, rng.random() * 0.6 + 0.15, rng.random() + 0.2
    total = a + b + c
    return {"HOME": a / total, "DRAW": b / total, "AWAY": c / total}


def draw_winner(probabilities, rng):
    threshold = rng.random()
    cumulative = 0.0
    for selection, p in probabilities.items():
        cumulative += p
        if threshold <= cumulative:
            return selection
    return list(probabilities)[-1]


def noisy(probabilities, sigma, rng):
    """Version bruitée d'une distribution, renormalisée."""
    perturbed = {
        k: max(0.02, v + rng.gauss(0, sigma)) for k, v in probabilities.items()
    }
    total = sum(perturbed.values())
    return {k: v / total for k, v in perturbed.items()}


def build_records(n, model_sigma, market_sigma, seed=7):
    """Génère n prévisions où modèle et marché s'écartent de la vérité."""
    rng = random.Random(seed)
    records = []
    for _ in range(n):
        truth = sample_truth(rng)
        records.append(cal.ForecastRecord(
            market_key="1X2",
            model=noisy(truth, model_sigma, rng),
            market=noisy(truth, market_sigma, rng),
            winner=draw_winner(truth, rng),
            odds={k: 1 / v for k, v in truth.items()},
        ))
    return records


# ════════════════════════════════════════════════════════════════════════════
#  OUTILS STATISTIQUES
# ════════════════════════════════════════════════════════════════════════════

class TestStatisticalHelpers(unittest.TestCase):

    def test_normal_cdf_reference_points(self):
        self.assertAlmostEqual(cal.normal_cdf(0), 0.5, places=9)
        self.assertAlmostEqual(cal.normal_cdf(1.959963985), 0.975, places=6)
        self.assertAlmostEqual(cal.normal_cdf(-1.959963985), 0.025, places=6)

    def test_two_sided_p_value(self):
        self.assertAlmostEqual(cal.two_sided_p_value(1.959963985), 0.05, places=6)
        self.assertAlmostEqual(cal.two_sided_p_value(0.0), 1.0, places=9)
        # Symétrique en signe.
        self.assertAlmostEqual(
            cal.two_sided_p_value(2.0), cal.two_sided_p_value(-2.0), places=12
        )

    def test_mean_and_stdev(self):
        self.assertAlmostEqual(cal.mean([1, 2, 3]), 2.0, places=9)
        self.assertAlmostEqual(cal.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2.13809, places=4)
        self.assertEqual(cal.mean([]), 0.0)
        self.assertEqual(cal.stdev([5]), 0.0)


# ════════════════════════════════════════════════════════════════════════════
#  RÈGLES DE SCORE
# ════════════════════════════════════════════════════════════════════════════

class TestScoringRules(unittest.TestCase):

    def record(self, model, winner="HOME", market=None):
        return cal.ForecastRecord(
            market_key="1X2", model=model, market=market or model, winner=winner
        )

    def test_perfect_forecast_scores_zero(self):
        records = [self.record({"HOME": 1.0, "DRAW": 0.0, "AWAY": 0.0})]
        self.assertAlmostEqual(cal.brier_score(records), 0.0, places=9)
        self.assertAlmostEqual(cal.log_loss(records), 0.0, places=9)

    def test_brier_known_value(self):
        # (0.6−1)² + (0.3−0)² + (0.1−0)² = 0.16 + 0.09 + 0.01 = 0.26
        records = [self.record({"HOME": 0.6, "DRAW": 0.3, "AWAY": 0.1})]
        self.assertAlmostEqual(cal.brier_score(records), 0.26, places=9)

    def test_log_loss_known_value(self):
        records = [self.record({"HOME": 0.5, "DRAW": 0.3, "AWAY": 0.2})]
        self.assertAlmostEqual(cal.log_loss(records), -math.log(0.5), places=9)

    def test_confident_and_wrong_is_punished(self):
        confident = [self.record({"HOME": 0.02, "DRAW": 0.49, "AWAY": 0.49})]
        humble = [self.record({"HOME": 0.33, "DRAW": 0.34, "AWAY": 0.33})]
        self.assertGreater(cal.log_loss(confident), cal.log_loss(humble))
        self.assertGreater(cal.brier_score(confident), cal.brier_score(humble))

    def test_empty_input(self):
        self.assertIsNone(cal.brier_score([]))
        self.assertIsNone(cal.log_loss([]))

    def test_skill_score_sign(self):
        self.assertAlmostEqual(cal.skill_score(0.5, 0.5), 0.0, places=12)
        self.assertGreater(cal.skill_score(0.4, 0.5), 0)     # modèle meilleur
        self.assertLess(cal.skill_score(0.6, 0.5), 0)        # marché meilleur
        self.assertIsNone(cal.skill_score(None, 0.5))
        self.assertIsNone(cal.skill_score(0.5, 0))


# ════════════════════════════════════════════════════════════════════════════
#  POIDS DU MARCHÉ DÉDUIT DES DONNÉES
# ════════════════════════════════════════════════════════════════════════════

class TestOptimalWeight(unittest.TestCase):

    def test_sharp_market_and_noisy_model_gives_full_weight_to_market(self):
        records = build_records(600, model_sigma=0.14, market_sigma=0.0, seed=11)
        weight = cal.optimal_market_weight(records)
        self.assertGreater(weight, 0.75)

    def test_sharp_model_and_noisy_market_gives_weight_to_model(self):
        records = build_records(600, model_sigma=0.0, market_sigma=0.14, seed=12)
        weight = cal.optimal_market_weight(records)
        self.assertLess(weight, 0.35)

    def test_equally_good_sources_land_in_between(self):
        records = build_records(900, model_sigma=0.08, market_sigma=0.08, seed=13)
        weight = cal.optimal_market_weight(records)
        self.assertGreater(weight, 0.15)
        self.assertLess(weight, 0.85)

    def test_weight_is_bounded_and_none_without_data(self):
        records = build_records(80, model_sigma=0.1, market_sigma=0.1)
        weight = cal.optimal_market_weight(records)
        self.assertGreaterEqual(weight, 0.0)
        self.assertLessEqual(weight, 1.0)
        self.assertIsNone(cal.optimal_market_weight([]))

    def test_blended_log_loss_beats_the_worse_source(self):
        records = build_records(600, model_sigma=0.10, market_sigma=0.04, seed=14)
        best = cal.optimal_market_weight(records)
        self.assertLessEqual(
            cal.blended_log_loss(records, best), cal.log_loss(records, "model") + 1e-9
        )
        self.assertLessEqual(
            cal.blended_log_loss(records, best), cal.log_loss(records, "market") + 1e-9
        )


# ════════════════════════════════════════════════════════════════════════════
#  RAPPORT DE CALIBRATION
# ════════════════════════════════════════════════════════════════════════════

class TestCalibrationReport(unittest.TestCase):

    def test_no_data(self):
        report = cal.calibration_report([])
        self.assertEqual(report["sample"], 0)
        self.assertEqual(report["verdict"], "AUCUNE DONNÉE")
        self.assertEqual(report["recommended_market_weight"], 1.0)
        self.assertFalse(report["conclusive"])

    def test_small_sample_is_never_conclusive(self):
        records = build_records(40, model_sigma=0.0, market_sigma=0.15, seed=15)
        report = cal.calibration_report(records)
        self.assertEqual(report["verdict"], "ÉCHANTILLON INSUFFISANT")
        self.assertFalse(report["beats_market"])
        # Même un modèle parfait ne gagne pas le droit de s'écarter du marché.
        self.assertEqual(report["recommended_market_weight"], 1.0)

    def test_model_worse_than_market_is_told_plainly(self):
        records = build_records(400, model_sigma=0.15, market_sigma=0.0, seed=16)
        report = cal.calibration_report(records)
        self.assertEqual(report["verdict"], "PAS MIEUX QUE LE MARCHÉ")
        self.assertFalse(report["beats_market"])
        self.assertLess(report["brier_skill_score"], 0)
        self.assertEqual(report["recommended_market_weight"], 1.0)

    def test_genuinely_better_model_is_recognised(self):
        records = build_records(500, model_sigma=0.0, market_sigma=0.15, seed=17)
        report = cal.calibration_report(records)
        self.assertEqual(report["verdict"], "MODÈLE INFORMATIF")
        self.assertTrue(report["beats_market"])
        self.assertGreater(report["brier_skill_score"], cal.SKILL_THRESHOLD)
        self.assertLess(report["recommended_market_weight"], 1.0)

    def test_report_carries_both_reliability_curves(self):
        records = build_records(300, model_sigma=0.06, market_sigma=0.06, seed=18)
        report = cal.calibration_report(records)
        self.assertTrue(report["reliability_model"])
        self.assertTrue(report["reliability_market"])
        for row in report["reliability_model"]:
            self.assertGreaterEqual(row["count"], 1)
            self.assertLessEqual(row["lower"], row["predicted"] + 1e-9)


class TestReliability(unittest.TestCase):

    def test_well_calibrated_model_tracks_the_diagonal(self):
        records = build_records(2000, model_sigma=0.0, market_sigma=0.0, seed=19)
        bins = cal.reliability_bins(records, "model")
        populated = [b for b in bins if b["count"] >= 100]
        self.assertTrue(populated)

        # La courbe se juge globalement : sur huit intervalles, un écart de plus
        # de deux erreurs types survient par hasard une fois sur trois environ.
        # On vérifie donc l'écart moyen pondéré, et qu'au plus un intervalle
        # sorte du bruit.
        total = sum(b["count"] for b in populated)
        weighted_gap = sum(abs(b["gap"]) * b["count"] for b in populated) / total
        self.assertLess(weighted_gap, 0.03, msg=f"écart moyen pondéré {weighted_gap:.4f}")
        outliers = [b for b in populated if not b["within_noise"]]
        self.assertLessEqual(
            len(outliers), 1,
            msg=f"{len(outliers)} intervalles hors bruit : {outliers}",
        )

    def test_miscalibrated_model_is_detected(self):
        # Un modèle systématiquement trop confiant doit s'écarter de la diagonale.
        rng = random.Random(31)
        records = []
        for _ in range(1200):
            truth = sample_truth(rng)
            overconfident = {k: v ** 2 for k, v in truth.items()}
            total = sum(overconfident.values())
            records.append(cal.ForecastRecord(
                market_key="1X2",
                model={k: v / total for k, v in overconfident.items()},
                market=truth,
                winner=draw_winner(truth, rng),
            ))
        bins = cal.reliability_bins(records, "model")
        populated = [b for b in bins if b["count"] >= 100]
        self.assertTrue(any(not b["within_noise"] for b in populated))
        self.assertGreater(cal.brier_score(records, "model"),
                           cal.brier_score(records, "market"))

    def test_bins_partition_the_sample(self):
        records = build_records(200, model_sigma=0.05, market_sigma=0.05, seed=20)
        bins = cal.reliability_bins(records, "model")
        self.assertEqual(sum(b["count"] for b in bins), 3 * len(records))


# ════════════════════════════════════════════════════════════════════════════
#  SIGNIFICATIVITÉ
# ════════════════════════════════════════════════════════════════════════════

class TestSignificance(unittest.TestCase):

    def test_flat_series_is_not_significant(self):
        returns = [1.0, -1.0] * 100
        test = cal.significance_test(returns)
        self.assertAlmostEqual(test["mean"], 0.0, places=9)
        self.assertFalse(test["significant"])
        self.assertIn("hasard", test["message"])

    def test_large_consistent_edge_is_significant(self):
        rng = random.Random(21)
        returns = [1.0 if rng.random() < 0.62 else -1.0 for _ in range(1200)]
        test = cal.significance_test(returns)
        self.assertTrue(test["significant"])
        self.assertGreater(test["t_stat"], 2)
        self.assertGreater(test["confidence_interval"][0], 0)

    def test_significant_loss_is_flagged_as_such(self):
        returns = [-1.0] * 40 + [1.0] * 10
        test = cal.significance_test(returns)
        self.assertTrue(test["significant"])
        self.assertLess(test["mean"], 0)
        self.assertIn("arrêter", test["message"])

    def test_degenerate_inputs(self):
        self.assertFalse(cal.significance_test([])["significant"])
        self.assertFalse(cal.significance_test([0.5])["significant"])
        constant = cal.significance_test([0.2, 0.2, 0.2])
        self.assertFalse(constant["significant"])
        self.assertEqual(constant["std_dev"], 0.0)

    def test_required_sample_size_orders_of_magnitude(self):
        small = cal.required_sample_size(0.02, 2.0)
        large = cal.required_sample_size(0.10, 2.0)
        self.assertGreater(small, large)
        # Un edge de 2 % à cote 2,00 demande des milliers de paris.
        self.assertGreater(small, 5000)
        # Plus la cote est haute, plus la variance est grande.
        self.assertGreater(
            cal.required_sample_size(0.02, 5.0), cal.required_sample_size(0.02, 2.0)
        )

    def test_required_sample_size_rejects_impossible_inputs(self):
        self.assertIsNone(cal.required_sample_size(0.0, 2.0))
        self.assertIsNone(cal.required_sample_size(-0.05, 2.0))
        self.assertIsNone(cal.required_sample_size(0.05, 1.0))

    def test_clv_summary(self):
        empty = cal.clv_summary([])
        self.assertEqual(empty["sample"], 0)
        self.assertFalse(empty["significant"])

        positive = cal.clv_summary([0.03, 0.05, 0.02, 0.04, 0.06] * 12)
        self.assertTrue(positive["significant"])
        self.assertGreater(positive["mean_pct"], 0)
        self.assertEqual(positive["beat_rate"], 1.0)

        negative = cal.clv_summary([-0.03, -0.02, -0.05] * 12)
        self.assertFalse(negative["significant"])
        self.assertLess(negative["mean_pct"], 0)
        self.assertIn("moins bonnes", negative["message"])


# ════════════════════════════════════════════════════════════════════════════
#  SIMULATION DE RISQUE
# ════════════════════════════════════════════════════════════════════════════

class TestSimulation(unittest.TestCase):

    def test_real_edge_grows_the_median_path(self):
        result = cal.simulate_strategy(
            n_bets=400, odds=2.0, true_edge=0.05, bankroll=1000, n_paths=400
        )
        self.assertGreater(result["final_bankroll"]["median"], 1000)
        # Mais une part notable des trajectoires perd quand même.
        self.assertGreater(result["probability_of_loss"], 0.02)

    def test_percentiles_are_ordered(self):
        result = cal.simulate_strategy(n_bets=200, true_edge=0.03, n_paths=400)
        bank = result["final_bankroll"]
        self.assertLessEqual(bank["p05"], bank["p25"])
        self.assertLessEqual(bank["p25"], bank["median"])
        self.assertLessEqual(bank["median"], bank["p75"])
        self.assertLessEqual(bank["p75"], bank["p95"])

    def test_believing_in_a_phantom_edge_destroys_capital(self):
        result = cal.simulate_strategy(
            n_bets=500, odds=2.0, true_edge=-0.03, believed_edge=0.04,
            bankroll=1000, n_paths=600,
        )
        self.assertLess(result["final_bankroll"]["median"], 1000)
        self.assertGreater(result["probability_of_loss"], 0.5)
        self.assertGreater(result["assumptions"]["stake_pct"], 0)
        self.assertIn("jamais calibré", result["message"])

    def test_kelly_refuses_to_bet_without_a_believed_edge(self):
        result = cal.simulate_strategy(
            n_bets=500, odds=2.0, true_edge=-0.05, bankroll=1000, n_paths=200
        )
        self.assertEqual(result["assumptions"]["stake_pct"], 0.0)
        self.assertEqual(result["final_bankroll"]["median"], 1000.0)
        self.assertIn("mise nulle", result["message"])

    def test_flat_staking_exposes_capital_even_without_edge(self):
        result = cal.simulate_strategy(
            n_bets=500, odds=2.0, true_edge=-0.05, bankroll=1000,
            staking="flat", flat_stake_pct=0.02, n_paths=600,
        )
        self.assertLess(result["final_bankroll"]["median"], 1000)
        self.assertGreater(result["probability_of_loss"], 0.6)

    def test_bigger_stakes_mean_bigger_drawdowns(self):
        prudent = cal.simulate_strategy(
            n_bets=400, true_edge=0.03, staking="flat", flat_stake_pct=0.01, n_paths=400
        )
        reckless = cal.simulate_strategy(
            n_bets=400, true_edge=0.03, staking="flat", flat_stake_pct=0.08, n_paths=400
        )
        self.assertGreater(
            reckless["drawdown"]["median_pct"], prudent["drawdown"]["median_pct"]
        )

    def test_histogram_accounts_for_every_path(self):
        result = cal.simulate_strategy(n_bets=150, true_edge=0.04, n_paths=500)
        self.assertEqual(sum(b["count"] for b in result["histogram"]), 500)

    def test_same_seed_gives_the_same_result(self):
        first = cal.simulate_strategy(n_bets=120, true_edge=0.03, n_paths=200, seed=99)
        second = cal.simulate_strategy(n_bets=120, true_edge=0.03, n_paths=200, seed=99)
        self.assertEqual(first["final_bankroll"], second["final_bankroll"])

    def test_inputs_are_clamped(self):
        result = cal.simulate_strategy(n_bets=99999, n_paths=1, true_edge=0.02)
        self.assertLessEqual(result["assumptions"]["n_bets"], 5000)
        self.assertGreaterEqual(result["assumptions"]["n_paths"], 50)


# ════════════════════════════════════════════════════════════════════════════
#  SYNTHÈSE
# ════════════════════════════════════════════════════════════════════════════

class TestRealismSummary(unittest.TestCase):

    def test_without_evidence_the_stance_is_to_follow_the_market(self):
        summary = cal.realism_summary(
            cal.calibration_report([]), cal.significance_test([]), cal.clv_summary([])
        )
        self.assertEqual(summary["stance"], "SUIVRE LE MARCHÉ")
        self.assertFalse(summary["established"])
        self.assertTrue(summary["actions"])

    def test_evidence_softens_the_stance(self):
        records = build_records(500, model_sigma=0.0, market_sigma=0.15, seed=22)
        summary = cal.realism_summary(
            cal.calibration_report(records),
            cal.significance_test([]),
            cal.clv_summary([0.03, 0.04, 0.05] * 20),
        )
        self.assertEqual(summary["stance"], "MISER PRUDEMMENT")
        self.assertTrue(summary["established"])

    def test_losing_model_never_earns_a_betting_stance(self):
        records = build_records(400, model_sigma=0.15, market_sigma=0.0, seed=23)
        summary = cal.realism_summary(
            cal.calibration_report(records),
            cal.significance_test([-1.0] * 30 + [1.0] * 10),
            cal.clv_summary([-0.04] * 30),
        )
        self.assertEqual(summary["stance"], "SUIVRE LE MARCHÉ")


if __name__ == "__main__":
    unittest.main(verbosity=2)
