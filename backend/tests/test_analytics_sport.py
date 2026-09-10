"""
Tests du moteur d'analyse sportive.

Aucune dépendance externe (unittest de la bibliothèque standard) : lançables
sans installer FastAPI ni base de données.

    cd backend && python3 -m unittest discover -s tests -v
"""

import math
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import analytics_sport as an  # noqa: E402


D = datetime(2026, 3, 1, tzinfo=timezone.utc)


def make_history():
    """Petit historique de référence : 3 équipes, 5 matchs, résultats connus."""
    return [
        an.MatchRecord("A", "B", 2, 1, kickoff=D),
        an.MatchRecord("B", "A", 0, 0, kickoff=D + timedelta(days=7)),
        an.MatchRecord("A", "C", 3, 0, kickoff=D + timedelta(days=14)),
        an.MatchRecord("C", "A", 1, 2, kickoff=D + timedelta(days=21)),
        an.MatchRecord("B", "C", 1, 1, kickoff=D + timedelta(days=28)),
    ]


def make_league(rounds=24, seed=11):
    """Championnat simulé de 10 équipes de forces connues."""
    import random
    rng = random.Random(seed)
    teams = [f"T{i}" for i in range(10)]
    quality = {t: 0.75 + 0.07 * i for i, t in enumerate(teams)}
    history = []
    for r in range(rounds):
        order = teams[:]
        rng.shuffle(order)
        for i in range(0, len(order) - 1, 2):
            h, a = order[i], order[i + 1]
            lam_h = 1.45 * quality[h] / quality[a]
            lam_a = 1.10 * quality[a] / quality[h]

            def draw(lam):
                limit, k, p = math.exp(-lam), 0, 1.0
                while True:
                    p *= rng.random()
                    if p <= limit:
                        return k
                    k += 1

            history.append(an.MatchRecord(
                h, a, draw(lam_h), draw(lam_a),
                kickoff=D + timedelta(days=r * 7),
            ))
    return history, quality


# ═══════════════════════════════════════════════════════════════════════════
#  BASES PROBABILISTES
# ═══════════════════════════════════════════════════════════════════════════

class TestPoisson(unittest.TestCase):

    def test_known_values(self):
        self.assertAlmostEqual(an.poisson_pmf(0, 1.0), math.exp(-1), places=10)
        self.assertAlmostEqual(an.poisson_pmf(2, 2.0), 2 * math.exp(-2), places=10)

    def test_distribution_sums_to_one(self):
        total = sum(an.poisson_pmf(k, 2.3) for k in range(40))
        self.assertAlmostEqual(total, 1.0, places=9)

    def test_degenerate_lambda(self):
        self.assertEqual(an.poisson_pmf(0, 0.0), 1.0)
        self.assertEqual(an.poisson_pmf(3, 0.0), 0.0)
        self.assertEqual(an.poisson_pmf(-1, 1.5), 0.0)


class TestOddsHelpers(unittest.TestCase):

    def test_implied_and_fair_odds_are_inverse(self):
        self.assertAlmostEqual(an.implied_probability(2.5), 0.4, places=12)
        self.assertAlmostEqual(an.fair_odds(0.4), 2.5, places=12)

    def test_invalid_odds_are_neutralised(self):
        self.assertEqual(an.implied_probability(1.0), 0.0)
        self.assertEqual(an.implied_probability(None), 0.0)
        self.assertIsNone(an.fair_odds(0.0))

    def test_overround_detects_margin(self):
        margin = an.overround([2.0, 2.0])
        self.assertAlmostEqual(margin, 0.0, places=12)
        self.assertGreater(an.overround([1.9, 1.9]), 0.05)
        self.assertIsNone(an.overround([2.0]))

    def test_edge_computation(self):
        self.assertAlmostEqual(an.edge(0.5, 2.2), 0.1, places=12)
        self.assertAlmostEqual(an.edge(0.5, 1.8), -0.1, places=12)
        self.assertIsNone(an.edge(0.5, 1.0))

    def test_kelly_is_fractional_and_capped(self):
        # p=0.55 @ 2.00 → Kelly plein = 0.10 de la bankroll
        full = an.kelly_stake(0.55, 2.0, bankroll=1000, fraction=1.0, cap_pct=1.0)
        self.assertAlmostEqual(full["full_kelly"], 0.10, places=6)
        self.assertAlmostEqual(full["stake"], 100.0, places=2)

        quarter = an.kelly_stake(0.55, 2.0, bankroll=1000, fraction=0.25, cap_pct=1.0)
        self.assertAlmostEqual(quarter["stake"], 25.0, places=2)

        capped = an.kelly_stake(0.90, 3.0, bankroll=1000, fraction=1.0, cap_pct=0.05)
        self.assertAlmostEqual(capped["stake_pct"], 0.05, places=6)
        self.assertAlmostEqual(capped["stake"], 50.0, places=2)

    def test_kelly_refuses_negative_edge(self):
        self.assertEqual(an.kelly_stake(0.40, 2.0, bankroll=1000)["stake"], 0.0)

    def test_blend_probabilities(self):
        self.assertAlmostEqual(an.blend_probabilities(0.60, 0.40, 0.5), 0.50, places=12)
        self.assertAlmostEqual(an.blend_probabilities(0.60, None, 0.5), 0.60, places=12)
        self.assertAlmostEqual(an.blend_probabilities(0.60, 0.40, 0.0), 0.60, places=12)
        self.assertAlmostEqual(an.blend_probabilities(0.60, 0.40, 1.0), 0.40, places=12)


class TestRemoveMargin(unittest.TestCase):

    ODDS = {"HOME": 2.30, "DRAW": 3.40, "AWAY": 3.10}

    def test_all_methods_normalise(self):
        for method in ("proportional", "odds_ratio", "power"):
            probabilities = an.remove_margin(self.ODDS, method)
            self.assertAlmostEqual(sum(probabilities.values()), 1.0, places=6, msg=method)

    def test_no_vig_probabilities_are_below_implied(self):
        for method in ("proportional", "odds_ratio", "power"):
            probabilities = an.remove_margin(self.ODDS, method)
            for selection, odds in self.ODDS.items():
                self.assertLess(probabilities[selection], an.implied_probability(odds))

    def test_ordering_is_preserved(self):
        for method in ("proportional", "odds_ratio", "power"):
            probabilities = an.remove_margin(self.ODDS, method)
            self.assertGreater(probabilities["HOME"], probabilities["AWAY"])
            self.assertGreater(probabilities["AWAY"], probabilities["DRAW"])

    def test_odds_ratio_shifts_value_away_from_favourite(self):
        proportional = an.remove_margin(self.ODDS, "proportional")
        odds_ratio = an.remove_margin(self.ODDS, "odds_ratio")
        self.assertGreater(odds_ratio["HOME"], proportional["HOME"])

    def test_unknown_method_raises(self):
        with self.assertRaises(ValueError):
            an.remove_margin(self.ODDS, "magique")

    def test_empty_and_single_inputs(self):
        self.assertEqual(an.remove_margin({}), {})
        self.assertEqual(list(an.remove_margin({"HOME": 2.0}).keys()), ["HOME"])


# ═══════════════════════════════════════════════════════════════════════════
#  GRILLE DE SCORES ET MARCHÉS
# ═══════════════════════════════════════════════════════════════════════════

class TestScoreGrid(unittest.TestCase):

    def setUp(self):
        self.grid = an.score_grid(1.6, 1.1)

    def test_grid_is_a_probability_distribution(self):
        total = sum(sum(row) for row in self.grid)
        self.assertAlmostEqual(total, 1.0, places=9)
        self.assertTrue(all(p >= 0 for row in self.grid for p in row))

    def test_expected_goals_match_lambdas(self):
        expected = an.market_probabilities(self.grid)["_EXPECTED"]
        # La correction Dixon-Coles décale légèrement les espérances.
        self.assertAlmostEqual(expected["home_goals"], 1.6, delta=0.08)
        self.assertAlmostEqual(expected["away_goals"], 1.1, delta=0.08)

    def test_dixon_coles_lifts_low_scores(self):
        plain = an.score_grid(1.6, 1.1, rho=0.0)
        adjusted = an.score_grid(1.6, 1.1, rho=-0.08)
        self.assertGreater(adjusted[0][0], plain[0][0])
        self.assertGreater(adjusted[1][1], plain[1][1])

    def test_tau_is_neutral_outside_low_scores(self):
        self.assertEqual(an.dixon_coles_tau(2, 3, 1.5, 1.2, -0.05), 1.0)


class TestMarkets(unittest.TestCase):

    def setUp(self):
        self.grid = an.score_grid(1.7, 1.0)
        self.markets = an.market_probabilities(self.grid)

    def test_1x2_is_coherent(self):
        one_x_two = self.markets["1X2"]
        self.assertAlmostEqual(sum(one_x_two.values()), 1.0, places=9)
        self.assertGreater(one_x_two["HOME"], one_x_two["AWAY"])

    def test_double_chance_matches_1x2(self):
        base = self.markets["1X2"]
        double = self.markets["DOUBLE_CHANCE"]
        self.assertAlmostEqual(double["1X"], base["HOME"] + base["DRAW"], places=9)
        self.assertAlmostEqual(double["12"], base["HOME"] + base["AWAY"], places=9)
        self.assertAlmostEqual(double["X2"], base["DRAW"] + base["AWAY"], places=9)

    def test_totals_sum_to_one_on_every_line(self):
        for line in an.DEFAULT_TOTAL_LINES:
            market = self.markets[f"OU_{line}"]
            self.assertAlmostEqual(sum(market.values()), 1.0, places=9, msg=str(line))
            self.assertNotIn("PUSH", market)  # lignes en .5 → pas de remboursement

    def test_totals_are_monotonic(self):
        previous = 1.0
        for line in an.DEFAULT_TOTAL_LINES:
            current = self.markets[f"OU_{line}"]["OVER"]
            self.assertLess(current, previous)
            previous = current

    def test_integer_total_line_has_push(self):
        market = an.totals_market(self.grid, 2.0)
        self.assertIn("PUSH", market)
        self.assertAlmostEqual(sum(market.values()), 1.0, places=9)

    def test_btts_and_derived_markets(self):
        self.assertAlmostEqual(sum(self.markets["BTTS"].values()), 1.0, places=9)
        self.assertAlmostEqual(sum(self.markets["ODD_EVEN"].values()), 1.0, places=9)
        # « marque au moins un but » = complément de « ne marque pas »
        home_scores = self.markets["TO_SCORE"]["HOME"]
        away_clean_sheet = self.markets["CLEAN_SHEET"]["AWAY"]
        self.assertAlmostEqual(home_scores + away_clean_sheet, 1.0, places=9)

    def test_win_to_nil_is_subset_of_win(self):
        self.assertLess(self.markets["WIN_TO_NIL"]["HOME"], self.markets["1X2"]["HOME"])

    def test_handicap_half_line_equals_1x2(self):
        # Domicile -0.5 gagne exactement quand le domicile gagne.
        self.assertAlmostEqual(
            self.markets["AH_-0.5"]["HOME"], self.markets["1X2"]["HOME"], places=9
        )
        self.assertNotIn("PUSH", self.markets["AH_-0.5"])

    def test_handicap_zero_pushes_on_draw(self):
        handicap = self.markets["AH_0.0"]
        self.assertAlmostEqual(handicap["PUSH"], self.markets["1X2"]["DRAW"], places=9)
        self.assertAlmostEqual(sum(handicap.values()), 1.0, places=9)

    def test_quarter_line_is_average_of_neighbours(self):
        low = an.asian_handicap(self.grid, -0.5)
        high = an.asian_handicap(self.grid, -1.0)
        quarter = an.asian_handicap(self.grid, -0.75)
        self.assertAlmostEqual(
            quarter["HOME"], (low["HOME"] + high.get("HOME", 0)) / 2, places=9
        )
        self.assertAlmostEqual(sum(quarter.values()), 1.0, places=9)

    def test_team_totals(self):
        self.assertAlmostEqual(sum(self.markets["HOME_OU_1.5"].values()), 1.0, places=9)
        self.assertGreater(
            self.markets["HOME_OU_0.5"]["OVER"], self.markets["AWAY_OU_0.5"]["OVER"]
        )

    def test_top_scores_are_sorted_and_priced(self):
        scores = an.most_likely_scores(self.grid, top=4)
        self.assertEqual(len(scores), 4)
        probabilities = [s["probability"] for s in scores]
        self.assertEqual(probabilities, sorted(probabilities, reverse=True))
        self.assertAlmostEqual(
            scores[0]["fair_odds"], 1 / scores[0]["probability"], places=9
        )


# ═══════════════════════════════════════════════════════════════════════════
#  FORCES D'ÉQUIPE ET BUTS ATTENDUS
# ═══════════════════════════════════════════════════════════════════════════

class TestStrengths(unittest.TestCase):

    def test_baseline_measures_home_advantage(self):
        history, _ = make_league()
        baseline = an.league_baseline(history, reference=D + timedelta(days=200))
        self.assertGreater(baseline.home_goals, baseline.away_goals)
        self.assertGreater(baseline.home_advantage, 1.0)
        self.assertEqual(baseline.matches, len(history))

    def test_empty_history_falls_back(self):
        baseline = an.league_baseline([])
        self.assertEqual(baseline.home_goals, an.FALLBACK_HOME_GOALS)
        strengths, _ = an.team_strengths([])
        self.assertEqual(strengths, {})

    def test_strengths_are_normalised_around_one(self):
        history, _ = make_league()
        strengths, _ = an.team_strengths(history, reference=D + timedelta(days=200))
        total_weight = sum(s.weight for s in strengths.values())
        mean_attack = sum(s.attack * s.weight for s in strengths.values()) / total_weight
        mean_defense = sum(s.defense * s.weight for s in strengths.values()) / total_weight
        self.assertAlmostEqual(mean_attack, 1.0, places=6)
        self.assertAlmostEqual(mean_defense, 1.0, places=6)

    def test_strengths_rank_the_best_teams_highest(self):
        history, quality = make_league(rounds=34)
        reference = D + timedelta(days=300)
        strengths, _ = an.team_strengths(history, reference=reference)
        ranked = sorted(strengths.values(), key=lambda s: -s.attack / s.defense)
        best_half = {s.team for s in ranked[:5]}
        strongest = {t for t, _ in sorted(quality.items(), key=lambda kv: -kv[1])[:5]}
        # Au moins 4 des 5 meilleures équipes réelles sont dans la moitié haute.
        self.assertGreaterEqual(len(best_half & strongest), 4)

    def test_model_is_calibrated_on_total_goals(self):
        history, _ = make_league(rounds=34)
        reference = D + timedelta(days=300)
        strengths, baseline = an.team_strengths(history, reference=reference)
        predicted = observed = 0.0
        for match in history:
            lam_h, lam_a = an.expected_goals(
                strengths.get(match.home), strengths.get(match.away), baseline
            )
            predicted += lam_h + lam_a
            observed += match.total_goals
        # Écart global inférieur à 5 % : le modèle ne dérive pas.
        self.assertLess(abs(predicted - observed) / observed, 0.05)

    def test_short_sample_is_pulled_towards_average(self):
        # Une équipe avec un seul très gros score ne doit pas devenir hors norme.
        history = [
            an.MatchRecord("A", "B", 7, 0, kickoff=D),
            an.MatchRecord("C", "D", 1, 1, kickoff=D),
            an.MatchRecord("D", "C", 1, 1, kickoff=D + timedelta(days=7)),
            an.MatchRecord("B", "A", 1, 1, kickoff=D + timedelta(days=7)),
        ]
        strengths, _ = an.team_strengths(history, reference=D + timedelta(days=10))
        self.assertLess(strengths["A"].attack, 2.6)

    def test_recency_weight_decays_by_half_life(self):
        reference = D + timedelta(days=180)
        self.assertAlmostEqual(
            an.recency_weight(D, reference, half_life_days=180), 0.5, places=9
        )
        self.assertAlmostEqual(an.recency_weight(reference, reference, 180), 1.0, places=9)
        self.assertEqual(an.recency_weight(None, reference, 180), 1.0)

    def test_expected_goals_favour_the_home_side(self):
        baseline = an.LeagueBaseline(
            goals_per_team=1.35, home_goals=1.55, away_goals=1.15,
            home_advantage=math.sqrt(1.55 / 1.15), matches=100,
        )
        neutral = an.TeamStrength("X", attack=1.0, defense=1.0)
        lam_h, lam_a = an.expected_goals(neutral, neutral, baseline)
        self.assertGreater(lam_h, lam_a)

    def test_boosts_shift_expected_goals(self):
        baseline = an.LeagueBaseline()
        neutral = an.TeamStrength("X")
        base_h, base_a = an.expected_goals(neutral, neutral, baseline)
        boosted_h, boosted_a = an.expected_goals(
            neutral, neutral, baseline, home_boost=0.8, away_boost=1.2
        )
        self.assertLess(boosted_h, base_h)
        self.assertGreater(boosted_a, base_a)

    def test_lambdas_stay_within_bounds(self):
        baseline = an.LeagueBaseline()
        monster = an.TeamStrength("M", attack=4.0, defense=0.2)
        minnow = an.TeamStrength("m", attack=0.2, defense=4.0)
        lam_h, lam_a = an.expected_goals(monster, minnow, baseline)
        self.assertLessEqual(lam_h, an.LAMBDA_MAX)
        self.assertGreaterEqual(lam_a, an.LAMBDA_MIN)


# ═══════════════════════════════════════════════════════════════════════════
#  FORME, CONFRONTATIONS, CLASSEMENT, ELO
# ═══════════════════════════════════════════════════════════════════════════

class TestForm(unittest.TestCase):

    def setUp(self):
        self.history = make_history()

    def test_form_figures_are_exact(self):
        form = an.team_form(self.history, "A")
        self.assertEqual(form["played"], 4)
        self.assertEqual((form["wins"], form["draws"], form["losses"]), (3, 1, 0))
        self.assertEqual(form["points"], 10)
        self.assertAlmostEqual(form["ppg"], 2.5, places=6)
        self.assertEqual((form["goals_for"], form["goals_against"]), (7, 2))
        self.assertEqual(form["goal_diff"], 5)
        self.assertAlmostEqual(form["btts_rate"], 0.5, places=6)
        self.assertAlmostEqual(form["clean_sheet_rate"], 0.5, places=6)
        self.assertAlmostEqual(form["failed_to_score_rate"], 0.25, places=6)
        self.assertAlmostEqual(form["over_rates"]["over_2.5"], 0.75, places=6)

    def test_form_string_is_most_recent_first(self):
        form = an.team_form(self.history, "A")
        self.assertEqual(form["form"], "WWDW")
        self.assertEqual(form["current_streak"], {"type": "W", "length": 2})
        self.assertEqual(form["unbeaten_run"], 4)

    def test_venue_split(self):
        home = an.team_form(self.history, "A", venue="HOME")
        away = an.team_form(self.history, "A", venue="AWAY")
        self.assertEqual(home["played"], 2)
        self.assertAlmostEqual(home["ppg"], 3.0, places=6)
        self.assertEqual(away["played"], 2)
        self.assertAlmostEqual(away["ppg"], 2.0, places=6)

    def test_last_n_limits_the_window(self):
        self.assertEqual(an.team_form(self.history, "A", last_n=2)["played"], 2)

    def test_unknown_team_returns_empty_block(self):
        form = an.team_form(self.history, "INCONNU")
        self.assertEqual(form["played"], 0)
        self.assertEqual(form["ppg"], 0.0)
        self.assertEqual(form["form"], "")

    def test_head_to_head(self):
        h2h = an.head_to_head(self.history, "A", "B")
        self.assertEqual(h2h["played"], 2)
        self.assertEqual((h2h["a_wins"], h2h["draws"], h2h["b_wins"]), (1, 1, 0))
        self.assertAlmostEqual(h2h["avg_total_goals"], 1.5, places=6)
        self.assertAlmostEqual(h2h["btts_rate"], 0.5, places=6)

    def test_head_to_head_without_history(self):
        self.assertEqual(an.head_to_head(self.history, "A", "INCONNU")["played"], 0)

    def test_standings_order_and_points(self):
        table = an.standings(self.history, {"A": "Alpha", "B": "Beta", "C": "Gamma"})
        self.assertEqual([r["name"] for r in table], ["Alpha", "Beta", "Gamma"])
        self.assertEqual(table[0]["points"], 10)
        self.assertEqual(table[0]["rank"], 1)
        self.assertAlmostEqual(table[0]["home_ppg"], 3.0, places=6)
        self.assertAlmostEqual(table[0]["away_ppg"], 2.0, places=6)
        self.assertEqual(sum(r["played"] for r in table), 2 * len(self.history))


class TestElo(unittest.TestCase):

    def test_winner_gains_what_loser_loses(self):
        ratings = an.elo_ratings([an.MatchRecord("A", "B", 1, 0, kickoff=D)])
        self.assertGreater(ratings["A"], 1500)
        self.assertLess(ratings["B"], 1500)
        self.assertAlmostEqual(ratings["A"] + ratings["B"], 3000.0, places=6)

    def test_big_win_moves_rating_further(self):
        narrow = an.elo_ratings([an.MatchRecord("A", "B", 1, 0, kickoff=D)])
        heavy = an.elo_ratings([an.MatchRecord("A", "B", 4, 0, kickoff=D)])
        self.assertGreater(heavy["A"], narrow["A"])

    def test_strong_teams_end_up_rated_higher(self):
        history, quality = make_league(rounds=34)
        ratings = an.elo_ratings(history)
        best = max(quality, key=quality.get)
        worst = min(quality, key=quality.get)
        self.assertGreater(ratings[best], ratings[worst])

    def test_probabilities_are_normalised_and_ordered(self):
        probabilities = an.elo_probabilities(1700, 1500)
        self.assertAlmostEqual(sum(probabilities.values()), 1.0, places=9)
        self.assertGreater(probabilities["HOME"], probabilities["AWAY"])
        even = an.elo_probabilities(1500, 1500, home_advantage=0.0)
        self.assertAlmostEqual(even["HOME"], even["AWAY"], places=9)


# ═══════════════════════════════════════════════════════════════════════════
#  DÉTECTION DE VALEUR ET VERDICT
# ═══════════════════════════════════════════════════════════════════════════

class TestValueDetection(unittest.TestCase):

    MODEL = {"1X2": {"HOME": 0.50, "DRAW": 0.28, "AWAY": 0.22}}

    def test_generous_odds_are_flagged_as_value(self):
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 2.60, "bookmaker": "A"},
            {"market": "1X2", "selection": "DRAW", "odds": 3.50, "bookmaker": "A"},
            {"market": "1X2", "selection": "AWAY", "odds": 4.20, "bookmaker": "A"},
        ]
        found = an.find_value_bets(self.MODEL, quotes, bankroll=1000, min_edge=0.03)
        home = next(f for f in found if f["selection"] == "HOME")
        self.assertTrue(home["is_value"])
        self.assertGreater(home["edge"], 0.03)
        self.assertGreater(home["kelly"]["stake"], 0)
        self.assertEqual(found[0]["selection"], "HOME")  # trié par edge

    def test_short_odds_produce_no_value(self):
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 1.60, "bookmaker": "A"},
            {"market": "1X2", "selection": "DRAW", "odds": 3.20, "bookmaker": "A"},
            {"market": "1X2", "selection": "AWAY", "odds": 4.00, "bookmaker": "A"},
        ]
        found = an.find_value_bets(self.MODEL, quotes, bankroll=1000)
        self.assertFalse(any(f["is_value"] for f in found))
        self.assertTrue(all(f["kelly"]["stake"] == 0 for f in found if f["edge"] <= 0))

    def test_best_available_odds_are_kept(self):
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 2.40, "bookmaker": "A"},
            {"market": "1X2", "selection": "HOME", "odds": 2.75, "bookmaker": "B"},
            {"market": "1X2", "selection": "DRAW", "odds": 3.40, "bookmaker": "A"},
            {"market": "1X2", "selection": "AWAY", "odds": 3.90, "bookmaker": "A"},
        ]
        found = an.find_value_bets(self.MODEL, quotes)
        home = next(f for f in found if f["selection"] == "HOME")
        self.assertEqual(home["odds"], 2.75)
        self.assertEqual(home["bookmaker"], "B")

    def test_market_weight_moderates_the_edge(self):
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 2.60, "bookmaker": "A"},
            {"market": "1X2", "selection": "DRAW", "odds": 3.50, "bookmaker": "A"},
            {"market": "1X2", "selection": "AWAY", "odds": 4.20, "bookmaker": "A"},
        ]
        pure = an.find_value_bets(self.MODEL, quotes, market_weight=0.0)
        blended = an.find_value_bets(self.MODEL, quotes, market_weight=0.6)
        pure_home = next(f for f in pure if f["selection"] == "HOME")["edge"]
        blended_home = next(f for f in blended if f["selection"] == "HOME")["edge"]
        self.assertLess(blended_home, pure_home)

    def test_unknown_markets_and_bad_quotes_are_ignored(self):
        quotes = [
            {"market": "MARCHE_INCONNU", "selection": "X", "odds": 5.0},
            {"market": "1X2", "selection": "HOME", "odds": 0.9},
            {"market": "1X2", "selection": "", "odds": 3.0},
        ]
        self.assertEqual(an.find_value_bets(self.MODEL, quotes), [])

    def test_confidence_grows_with_sample_size(self):
        self.assertEqual(an.sample_confidence(0, 0)["label"], "AUCUNE DONNÉE")
        self.assertEqual(an.sample_confidence(3, 20)["label"], "FAIBLE")
        self.assertEqual(an.sample_confidence(8, 9)["label"], "MOYENNE")
        self.assertEqual(an.sample_confidence(30, 40)["label"], "ÉLEVÉE")
        self.assertGreater(
            an.sample_confidence(30, 30)["score"], an.sample_confidence(8, 8)["score"]
        )

    def test_verdict_warns_when_no_odds_available(self):
        markets = an.market_probabilities(an.score_grid(1.4, 1.3))
        verdict = an.build_verdict(markets, an.sample_confidence(20, 20), [])
        self.assertEqual(verdict["action"], "PASSER")
        self.assertTrue(any("cote" in w.lower() for w in verdict["warnings"]))

    def test_verdict_recommends_the_best_value(self):
        markets = an.market_probabilities(an.score_grid(1.8, 0.9))
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 2.60},
            {"market": "1X2", "selection": "DRAW", "odds": 3.60},
            {"market": "1X2", "selection": "AWAY", "odds": 5.00},
        ]
        value = an.find_value_bets(markets, quotes, bankroll=1000)
        verdict = an.build_verdict(markets, an.sample_confidence(25, 25), value)
        self.assertEqual(verdict["action"], "PARIER")
        self.assertEqual(verdict["most_likely_outcome"], "HOME")
        self.assertIsNotNone(verdict["recommended_bet"])

    def test_verdict_flags_a_weak_sample(self):
        markets = an.market_probabilities(an.score_grid(1.4, 1.3))
        verdict = an.build_verdict(markets, an.sample_confidence(2, 2), [])
        self.assertTrue(any("échantillon" in w.lower() for w in verdict["warnings"]))


class TestAnalyseMatch(unittest.TestCase):

    def test_full_analysis_structure(self):
        history, _ = make_league(rounds=30)
        quotes = [
            {"market": "1X2", "selection": "HOME", "odds": 2.40},
            {"market": "1X2", "selection": "DRAW", "odds": 3.40},
            {"market": "1X2", "selection": "AWAY", "odds": 3.00},
        ]
        result = an.analyse_match(
            history, "T9", "T0", quotes=quotes, bankroll=1000,
            reference=D + timedelta(days=300),
        )
        for key in ("expected_goals", "markets", "fair_odds", "top_scores",
                    "elo", "form", "head_to_head", "value_bets", "verdict"):
            self.assertIn(key, result)
        self.assertAlmostEqual(sum(result["markets"]["1X2"].values()), 1.0, places=3)
        # T9 est la meilleure équipe et joue à domicile.
        self.assertGreater(result["expected_goals"]["home"], result["expected_goals"]["away"])
        self.assertEqual(result["verdict"]["most_likely_outcome"], "HOME")

    def test_analysis_without_history_is_still_usable(self):
        result = an.analyse_match([], "X", "Y")
        self.assertAlmostEqual(sum(result["markets"]["1X2"].values()), 1.0, places=3)
        self.assertEqual(result["verdict"]["confidence"]["label"], "AUCUNE DONNÉE")
        self.assertEqual(result["verdict"]["action"], "PASSER")


# ═══════════════════════════════════════════════════════════════════════════
#  RÈGLEMENT DES PARIS
# ═══════════════════════════════════════════════════════════════════════════

class TestSettlement(unittest.TestCase):

    CASES = [
        ("1X2", "HOME", 2, 1, "WON"),
        ("1X2", "HOME", 1, 1, "LOST"),
        ("1X2", "DRAW", 1, 1, "WON"),
        ("1X2", "AWAY", 0, 2, "WON"),
        ("DOUBLE_CHANCE", "1X", 1, 1, "WON"),
        ("DOUBLE_CHANCE", "12", 1, 1, "LOST"),
        ("DOUBLE_CHANCE", "X2", 0, 1, "WON"),
        ("BTTS", "YES", 1, 1, "WON"),
        ("BTTS", "YES", 1, 0, "LOST"),
        ("BTTS", "NO", 3, 0, "WON"),
        ("OU_2.5", "OVER", 2, 1, "WON"),
        ("OU_2.5", "UNDER", 1, 1, "WON"),
        ("OU_3.0", "OVER", 2, 1, "VOID"),
        ("OU_3.0", "OVER", 3, 1, "WON"),
        ("HOME_OU_1.5", "OVER", 2, 0, "WON"),
        ("AWAY_OU_0.5", "UNDER", 2, 0, "WON"),
        ("AH_0.0", "HOME", 1, 1, "VOID"),
        ("AH_-1.0", "HOME", 2, 1, "VOID"),
        ("AH_-1.0", "HOME", 3, 1, "WON"),
        ("AH_-1.0", "AWAY", 1, 1, "WON"),
        ("AH_-0.5", "AWAY", 1, 1, "WON"),
        ("AH_1.5", "AWAY", 0, 2, "WON"),
        # Lignes en quart de but : la mise est scindée.
        ("AH_-0.25", "HOME", 1, 1, "HALF_LOST"),
        ("AH_-0.25", "HOME", 2, 1, "WON"),
        ("AH_0.25", "HOME", 1, 1, "HALF_WON"),
        ("AH_-0.75", "HOME", 2, 1, "HALF_WON"),
        ("AH_-0.75", "HOME", 3, 1, "WON"),
        ("AH_-0.75", "HOME", 1, 1, "LOST"),
        ("CORRECT_SCORE", "2-1", 2, 1, "WON"),
        ("CORRECT_SCORE", "2-1", 1, 2, "LOST"),
        ("ODD_EVEN", "ODD", 2, 1, "WON"),
        ("ODD_EVEN", "EVEN", 1, 1, "WON"),
        ("CLEAN_SHEET", "HOME", 2, 0, "WON"),
        ("TO_SCORE", "AWAY", 1, 0, "LOST"),
        ("WIN_TO_NIL", "AWAY", 0, 2, "WON"),
        ("WIN_TO_NIL", "AWAY", 1, 2, "LOST"),
    ]

    def test_settlement_table(self):
        for market, selection, hg, ag, expected in self.CASES:
            with self.subTest(market=market, selection=selection, score=f"{hg}-{ag}"):
                self.assertEqual(
                    an.settle_selection(market, selection, hg, ag), expected
                )

    def test_case_insensitive(self):
        self.assertEqual(an.settle_selection("ou_2.5", "over", 2, 1), "WON")

    def test_unknown_market_returns_none(self):
        self.assertIsNone(an.settle_selection("PREMIER_BUTEUR", "MESSI", 1, 0))
        self.assertIsNone(an.settle_selection("CORRECT_SCORE", "N IMPORTE QUOI", 1, 0))
        self.assertIsNone(an.settle_selection("1X2", "PEUT-ETRE", 1, 0))
        self.assertIsNone(an.settle_selection("OU_abc", "OVER", 1, 0))


# ═══════════════════════════════════════════════════════════════════════════
#  PERFORMANCE DU PARIEUR
# ═══════════════════════════════════════════════════════════════════════════

class TestBetPerformance(unittest.TestCase):

    def test_profit_by_status(self):
        self.assertAlmostEqual(
            an.BetRecord(stake=100, odds=2.5, status="WON").net_profit(), 150.0, places=6)
        self.assertAlmostEqual(
            an.BetRecord(stake=100, odds=2.5, status="LOST").net_profit(), -100.0, places=6)
        self.assertAlmostEqual(
            an.BetRecord(stake=100, odds=2.5, status="HALF_WON").net_profit(), 75.0, places=6)
        self.assertAlmostEqual(
            an.BetRecord(stake=100, odds=2.5, status="HALF_LOST").net_profit(), -50.0, places=6)
        self.assertEqual(an.BetRecord(stake=100, odds=2.5, status="VOID").net_profit(), 0.0)
        self.assertEqual(an.BetRecord(stake=100, odds=2.5, status="PENDING").net_profit(), 0.0)

    def test_explicit_profit_wins_over_status(self):
        record = an.BetRecord(stake=100, odds=3.0, status="CASHOUT", profit=42.0)
        self.assertAlmostEqual(record.net_profit(), 42.0, places=6)

    def test_headline_metrics(self):
        bets = [
            an.BetRecord(stake=100, odds=2.0, status="WON", market="1X2",
                         placed_at=D, closing_odds=1.80),
            an.BetRecord(stake=100, odds=2.0, status="LOST", market="1X2",
                         placed_at=D + timedelta(days=1), closing_odds=2.20),
            an.BetRecord(stake=50, odds=3.0, status="VOID", market="BTTS",
                         placed_at=D + timedelta(days=2)),
            an.BetRecord(stake=80, odds=1.9, status="PENDING", market="OU_2.5",
                         placed_at=D + timedelta(days=3)),
        ]
        perf = an.bet_performance(bets, starting_bankroll=1000)
        self.assertEqual(perf["bets_total"], 4)
        self.assertEqual(perf["bets_settled"], 3)
        self.assertEqual(perf["bets_pending"], 1)
        self.assertAlmostEqual(perf["pending_stake"], 80.0, places=6)
        # La mise remboursée (VOID) n'entre pas dans le total misé.
        self.assertAlmostEqual(perf["staked"], 200.0, places=6)
        self.assertAlmostEqual(perf["profit"], 0.0, places=6)
        self.assertAlmostEqual(perf["roi"], 0.0, places=6)
        self.assertAlmostEqual(perf["win_rate"], 0.5, places=6)
        self.assertAlmostEqual(perf["current_bankroll"], 1000.0, places=6)

    def test_drawdown_is_measured_from_the_peak(self):
        bets = [
            an.BetRecord(stake=100, odds=3.0, status="WON", placed_at=D),           # +200
            an.BetRecord(stake=100, odds=2.0, status="LOST", placed_at=D + timedelta(1)),
            an.BetRecord(stake=100, odds=2.0, status="LOST", placed_at=D + timedelta(2)),
        ]
        perf = an.bet_performance(bets, starting_bankroll=1000)
        # Sommet à 1200, plancher à 1000 → recul de 200 (16.67 %)
        self.assertAlmostEqual(perf["max_drawdown"], 200.0, places=6)
        self.assertAlmostEqual(perf["max_drawdown_pct"], 200 / 1200 * 100, places=2)
        self.assertEqual(perf["worst_losing_streak"], 2)
        self.assertEqual(perf["best_winning_streak"], 1)

    def test_bankroll_curve_follows_chronology(self):
        bets = [
            an.BetRecord(stake=100, odds=2.0, status="WON", placed_at=D + timedelta(2)),
            an.BetRecord(stake=100, odds=2.0, status="LOST", placed_at=D),
        ]
        curve = an.bet_performance(bets, starting_bankroll=500)["bankroll_curve"]
        self.assertEqual([point["bankroll"] for point in curve], [500.0, 400.0, 500.0])

    def test_clv_is_averaged_and_counted(self):
        bets = [
            an.BetRecord(stake=10, odds=2.00, status="WON", closing_odds=2.20, placed_at=D),
            an.BetRecord(stake=10, odds=2.00, status="LOST", closing_odds=1.80, placed_at=D),
        ]
        perf = an.bet_performance(bets)
        self.assertAlmostEqual(perf["clv_avg_pct"], 0.0, places=4)
        self.assertAlmostEqual(perf["clv_beat_rate"], 0.5, places=6)

    def test_breakdown_by_market(self):
        bets = [
            an.BetRecord(stake=100, odds=2.0, status="WON", market="1X2", placed_at=D),
            an.BetRecord(stake=100, odds=2.0, status="LOST", market="BTTS", placed_at=D),
        ]
        rows = {r["market"]: r for r in an.bet_performance(bets)["by_market"]}
        self.assertAlmostEqual(rows["1X2"]["roi"], 1.0, places=6)
        self.assertAlmostEqual(rows["BTTS"]["roi"], -1.0, places=6)
        self.assertEqual(rows["1X2"]["win_rate"], 1.0)

    def test_empty_portfolio(self):
        perf = an.bet_performance([], starting_bankroll=250)
        self.assertEqual(perf["bets_total"], 0)
        self.assertEqual(perf["roi"], 0.0)
        self.assertEqual(perf["max_drawdown"], 0.0)
        self.assertAlmostEqual(perf["current_bankroll"], 250.0, places=6)


if __name__ == "__main__":
    unittest.main(verbosity=2)
