import React, { useCallback, useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { FormPills, ProbabilityBars, ScoreHeatmap, StatTile } from './charts.jsx';
import {
  confidenceTone, dateTime, marketLabel, money, nf, pct, signed,
} from '../lib/format.js';

const OUTCOME_LABEL = { HOME: 'Domicile', DRAW: 'Nul', AWAY: 'Extérieur' };

/** Lignes de marché regroupées pour le tableau détaillé. */
const MARKET_GROUPS = [
  { title: 'Total de buts', keys: ['OU_1.5', 'OU_2.5', 'OU_3.5'] },
  { title: 'Les deux marquent', keys: ['BTTS'] },
  { title: 'Double chance', keys: ['DOUBLE_CHANCE'] },
  { title: 'Handicap asiatique', keys: ['AH_-1.0', 'AH_-0.5', 'AH_0.5', 'AH_1.0'] },
  { title: 'Buts par équipe', keys: ['HOME_OU_1.5', 'AWAY_OU_1.5'] },
];

export default function MatchAnalysis({ matchId, onPlaced }) {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    min_edge: 0.03, kelly_fraction: 0.25, market_weight: 0.35, form_window: 10,
  });
  const [betDraft, setBetDraft] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = useCallback(() => {
    if (!matchId) return;
    setLoading(true);
    sportApi.analysis(matchId, params)
      .then(r => { setAnalysis(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [matchId, params]);

  useEffect(load, [load]);

  if (!matchId) {
    return <div className="empty">Sélectionnez un match pour lancer l'analyse.</div>;
  }
  if (error) return <div className="notice error">{error}</div>;
  if (!analysis) return <div className="empty">Analyse en cours…</div>;

  const {
    teams, expected_goals: xg, markets, fair_odds: fair, value_bets: value,
    verdict, form, head_to_head: h2h, elo, strengths, baseline, match, score_matrix: matrix,
  } = analysis;

  const quoteFor = (market, selection) =>
    value.find(v => v.market === market && v.selection === selection);

  const oneX2Rows = ['HOME', 'DRAW', 'AWAY'].map(selection => {
    const quote = quoteFor('1X2', selection);
    return {
      label: OUTCOME_LABEL[selection],
      model: markets['1X2'][selection],
      modelOdds: fair['1X2'][selection],
      market: quote?.market_probability ?? null,
      marketOdds: quote?.odds ?? null,
    };
  });

  const submitBet = async () => {
    try {
      await sportApi.createBet({
        match_id: matchId,
        market: betDraft.market,
        selection: betDraft.selection,
        odds: Number(betDraft.odds),
        stake: Number(betDraft.stake),
        bookmaker: betDraft.bookmaker || null,
        model_probability: betDraft.model_probability ?? null,
        label: `${teams.home.name} — ${teams.away.name}`,
      });
      setFlash('Pari enregistré. Il sera réglé automatiquement à la saisie du score.');
      setBetDraft(null);
      onPlaced?.();
    } catch (e) {
      setFlash(`Échec : ${errorMessage(e)}`);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h1>{teams.home.name} — {teams.away.name}</h1>
            <div className="small muted">
              {match?.competition} · {dateTime(match?.kickoff)}
              {match?.score ? ` · score final ${match.score}` : ''}
            </div>
          </div>
          <div className="btn-row">
            <span className={`badge ${confidenceTone[verdict.confidence.label] || ''}`}>
              Fiabilité : {verdict.confidence.label} ({verdict.confidence.score}/100)
            </span>
            <span className={`badge ${verdict.action === 'PARIER' ? 'good' : ''}`}>
              {verdict.action === 'PARIER' ? 'Valeur détectée' : 'Ne pas parier'}
            </span>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="min-edge">Seuil de valeur</label>
            <select
              id="min-edge" value={params.min_edge}
              onChange={e => setParams({ ...params, min_edge: Number(e.target.value) })}
            >
              <option value={0}>0 % (tout afficher)</option>
              <option value={0.02}>2 %</option>
              <option value={0.03}>3 % (recommandé)</option>
              <option value={0.05}>5 %</option>
              <option value={0.08}>8 % (très sélectif)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="kelly">Fraction de Kelly</label>
            <select
              id="kelly" value={params.kelly_fraction}
              onChange={e => setParams({ ...params, kelly_fraction: Number(e.target.value) })}
            >
              <option value={0.125}>1/8 (très prudent)</option>
              <option value={0.25}>1/4 (recommandé)</option>
              <option value={0.5}>1/2 (agressif)</option>
              <option value={1}>Kelly plein (déconseillé)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="weight">Poids du marché</label>
            <select
              id="weight" value={params.market_weight}
              onChange={e => setParams({ ...params, market_weight: Number(e.target.value) })}
            >
              <option value={0}>0 % — modèle seul</option>
              <option value={0.35}>35 % — recommandé</option>
              <option value={0.5}>50 % — prudent</option>
              <option value={0.75}>75 % — très prudent</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="window">Fenêtre de forme</label>
            <select
              id="window" value={params.form_window}
              onChange={e => setParams({ ...params, form_window: Number(e.target.value) })}
            >
              {[5, 6, 8, 10, 15, 20].map(n => <option key={n} value={n}>{n} matchs</option>)}
            </select>
          </div>
          <button className="ghost" onClick={load} disabled={loading}>
            {loading ? 'Calcul…' : 'Recalculer'}
          </button>
        </div>

        {verdict.warnings?.length > 0 && (
          <div className="notice">
            <strong>À prendre en compte</strong>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {verdict.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-4">
        <StatTile
          label="Buts attendus — domicile" value={nf(xg.home)}
          sub={`attaque ${nf(strengths.home?.attack ?? 1)} · défense ${nf(strengths.home?.defense ?? 1)}`}
        />
        <StatTile
          label="Buts attendus — extérieur" value={nf(xg.away)}
          sub={`attaque ${nf(strengths.away?.attack ?? 1)} · défense ${nf(strengths.away?.defense ?? 1)}`}
        />
        <StatTile
          label="Total attendu" value={nf(xg.total)}
          sub={`tendance ${verdict.goals_lean} · moyenne du championnat ${nf(baseline.avg_total_goals)}`}
        />
        <StatTile
          label="Écart de niveau" value={signed(xg.supremacy)}
          sub={`Elo ${nf(elo.home, 0)} contre ${nf(elo.away, 0)} (${signed(elo.diff, 0)})`}
        />
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Issue du match</h2>
            <span className="hint">probabilité et cote équitable</span>
          </div>
          <ProbabilityBars rows={oneX2Rows} />
          <div className="card-note">
            Contrôle croisé par l'Elo (modèle indépendant) : domicile{' '}
            {pct(elo.probabilities.HOME)} · nul {pct(elo.probabilities.DRAW)} · extérieur{' '}
            {pct(elo.probabilities.AWAY)}. Un écart important avec le modèle de buts
            invite à la prudence.
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Scores exacts</h2>
            <span className="hint">grille Poisson corrigée</span>
          </div>
          <ScoreHeatmap matrix={matrix} homeName={teams.home.name} awayName={teams.away.name} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Paris de valeur</h2>
          <span className="hint">
            classés par edge · mise de Kelly fractionnée sur bankroll de {money(analysis.bankroll)}
          </span>
        </div>
        {value.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sélection</th><th>Bookmaker</th>
                  <th className="num">Cote</th><th className="num">Cote juste</th>
                  <th className="num">Modèle</th><th className="num">Marché</th>
                  <th className="num">Edge</th><th className="num">Mise conseillée</th><th />
                </tr>
              </thead>
              <tbody>
                {value.map((bet, i) => (
                  <tr key={i}>
                    <td>{marketLabel(bet.market, bet.selection)}</td>
                    <td>{bet.bookmaker || '—'}</td>
                    <td className="num">{nf(bet.odds)}</td>
                    <td className="num">{nf(bet.fair_odds)}</td>
                    <td className="num">{pct(bet.model_probability)}</td>
                    <td className="num">{bet.market_probability ? pct(bet.market_probability) : '—'}</td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 600,
                        color: bet.edge > 0 ? 'var(--good-text)' : 'var(--critical)',
                      }}
                    >
                      {signed(bet.edge_pct, 2)} %
                    </td>
                    <td className="num">{bet.is_value ? money(bet.kelly.stake) : '—'}</td>
                    <td>
                      <button
                        className="ghost small"
                        onClick={() => setBetDraft({
                          market: bet.market, selection: bet.selection, odds: bet.odds,
                          stake: bet.kelly.stake || 10, bookmaker: bet.bookmaker || '',
                          model_probability: bet.blended_probability,
                        })}
                      >
                        Miser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Aucune cote enregistrée pour ce match : l'analyse reste valable, mais la
            valeur ne peut pas être mesurée. Ajoutez les cotes dans l'onglet «&nbsp;Données&nbsp;».
          </div>
        )}
        {flash && <div className="notice ok" style={{ marginTop: 12 }}>{flash}</div>}
        {betDraft && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <div className="card-head">
              <h3>Enregistrer le pari — {marketLabel(betDraft.market, betDraft.selection)}</h3>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="bet-odds">Cote obtenue</label>
                <input
                  id="bet-odds" type="number" step="0.01" min="1.01" value={betDraft.odds}
                  onChange={e => setBetDraft({ ...betDraft, odds: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="bet-stake">Mise (€)</label>
                <input
                  id="bet-stake" type="number" step="0.5" min="0.5" value={betDraft.stake}
                  onChange={e => setBetDraft({ ...betDraft, stake: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="bet-book">Bookmaker</label>
                <input
                  id="bet-book" value={betDraft.bookmaker}
                  onChange={e => setBetDraft({ ...betDraft, bookmaker: e.target.value })}
                />
              </div>
              <div className="btn-row">
                <button className="primary" onClick={submitBet}>Enregistrer</button>
                <button className="ghost" onClick={() => setBetDraft(null)}>Annuler</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Tous les marchés</h2>
          <span className="hint">probabilité du modèle et cote équitable correspondante</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Marché</th><th>Sélection</th>
                <th className="num">Probabilité</th><th className="num">Cote juste</th>
                <th className="num">Meilleure cote</th><th className="num">Edge</th>
              </tr>
            </thead>
            <tbody>
              {MARKET_GROUPS.flatMap(group =>
                group.keys.filter(key => markets[key]).flatMap(key =>
                  Object.entries(markets[key])
                    .filter(([selection]) => selection !== 'PUSH')
                    .map(([selection, probability]) => {
                      const quote = quoteFor(key, selection);
                      return (
                        <tr key={`${key}-${selection}`}>
                          <td className="muted">{group.title}</td>
                          <td>{marketLabel(key, selection)}</td>
                          <td className="num">{pct(probability)}</td>
                          <td className="num">{nf(fair[key]?.[selection])}</td>
                          <td className="num">{quote ? nf(quote.odds) : '—'}</td>
                          <td
                            className="num"
                            style={{ color: quote && quote.edge > 0 ? 'var(--good-text)' : 'var(--ink-2)' }}
                          >
                            {quote ? `${signed(quote.edge_pct, 2)} %` : '—'}
                          </td>
                        </tr>
                      );
                    })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Forme comparée</h2>
            <span className="hint">{params.form_window} derniers matchs</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bloc</th><th>Forme</th><th className="num">Pts/match</th>
                  <th className="num">Buts pour</th><th className="num">Buts contre</th>
                  <th className="num">+2,5 buts</th><th className="num">Les deux marquent</th>
                  <th className="num">Sans encaisser</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [`${teams.home.name} — global`, form.home_overall],
                  [`${teams.home.name} — à domicile`, form.home_at_home],
                  [`${teams.away.name} — global`, form.away_overall],
                  [`${teams.away.name} — à l'extérieur`, form.away_at_away],
                ].map(([label, block]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td><FormPills form={block.form} /></td>
                    <td className="num">{nf(block.ppg)}</td>
                    <td className="num">{nf(block.avg_goals_for)}</td>
                    <td className="num">{nf(block.avg_goals_against)}</td>
                    <td className="num">{pct(block.over_rates?.['over_2.5'] ?? 0)}</td>
                    <td className="num">{pct(block.btts_rate)}</td>
                    <td className="num">{pct(block.clean_sheet_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-note">
            L'écart entre le bloc global et le bloc domicile/extérieur est souvent
            plus parlant que la forme brute : certaines équipes changent de visage
            selon le terrain.
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Confrontations directes</h2>
            <span className="hint">{h2h.played} match(s)</span>
          </div>
          {h2h.played ? (
            <>
              <div className="row small" style={{ marginBottom: 10 }}>
                <span>{teams.home.name} : <strong>{h2h.a_wins}</strong> victoire(s)</span>
                <span>Nuls : <strong>{h2h.draws}</strong></span>
                <span>{teams.away.name} : <strong>{h2h.b_wins}</strong></span>
                <span className="muted">
                  {nf(h2h.avg_total_goals)} buts par match · les deux marquent {pct(h2h.btts_rate)}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Rencontre</th><th className="num">Score</th></tr>
                  </thead>
                  <tbody>
                    {h2h.matches.map((row, i) => (
                      <tr key={i}>
                        <td>{dateTime(row.kickoff)}</td>
                        <td>{row.home} — {row.away}</td>
                        <td className="num">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-note">
                Sur un si petit échantillon, l'historique direct pèse peu :
                il sert d'indice de contexte, pas de preuve.
              </div>
            </>
          ) : <div className="empty">Aucune confrontation dans l'historique enregistré.</div>}
        </div>
      </div>
    </div>
  );
}
