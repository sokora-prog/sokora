import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { StatTile } from './charts.jsx';
import { OutcomeDistribution, ReliabilityCurve } from './charts_realism.jsx';
import { money, nf, pct, signed } from '../lib/format.js';

const VERDICT_TONE = {
  'MODÈLE INFORMATIF': 'good',
  'PAS MIEUX QUE LE MARCHÉ': 'critical',
  'ÉCHANTILLON INSUFFISANT': 'warning',
  'AUCUNE DONNÉE': 'warning',
};

export default function Realism({ competitions }) {
  const [params, setParams] = useState({ competition_id: '', market: '1X2', min_history: 30 });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [sim, setSim] = useState(null);
  const [simParams, setSimParams] = useState({
    true_edge: -0.02, believed_edge: 0.04, n_bets: 500, odds: 2.0,
    staking: 'kelly', kelly_fraction: 0.25, bankroll: 1000, n_paths: 2000,
  });
  const [simLoading, setSimLoading] = useState(false);

  const loadCalibration = () => {
    setLoading(true);
    const query = { market: params.market, min_history: params.min_history };
    if (params.competition_id) query.competition_id = params.competition_id;
    sportApi.calibration(query)
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  const runSimulation = () => {
    setSimLoading(true);
    sportApi.riskSimulation(simParams)
      .then(r => setSim(r.data))
      .catch(e => setError(errorMessage(e)))
      .finally(() => setSimLoading(false));
  };

  useEffect(loadCalibration, [params]);
  useEffect(runSimulation, []);

  const report = data?.report;
  const summary = data?.summary;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h1>Réalisme — ce que vos données prouvent vraiment</h1>
            <div className="small muted">
              Hypothèse de départ : le marché a raison. C'est au modèle de démontrer
              le contraire avant qu'une mise soit justifiée.
            </div>
          </div>
          {summary && (
            <span className={`badge ${summary.stance === 'SUIVRE LE MARCHÉ' ? 'critical' : 'good'}`}>
              {summary.stance}
            </span>
          )}
        </div>

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="rl-comp">Compétition</label>
            <select
              id="rl-comp" value={params.competition_id}
              onChange={e => setParams({ ...params, competition_id: e.target.value })}
            >
              <option value="">Toutes</option>
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rl-market">Marché évalué</label>
            <select
              id="rl-market" value={params.market}
              onChange={e => setParams({ ...params, market: e.target.value })}
            >
              {(data?.available_markets?.length
                ? data.available_markets.map(m => m.market)
                : ['1X2', 'OU_2.5', 'BTTS']
              ).map(market => <option key={market} value={market}>{market}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rl-history">Historique minimal</label>
            <input
              id="rl-history" type="number" min="10" step="10" value={params.min_history}
              onChange={e => setParams({ ...params, min_history: Number(e.target.value) })}
            />
          </div>
          <button className="ghost" onClick={loadCalibration} disabled={loading}>
            {loading ? 'Calcul…' : 'Recalculer'}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {data?.demo_caveat && (
        <div className="notice">
          <strong>Données de démonstration</strong> — {data.demo_caveat}
        </div>
      )}

      {report && (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Verdict</h2>
              <span className={`badge ${VERDICT_TONE[report.verdict] || ''}`}>{report.verdict}</span>
            </div>
            <p>{report.message}</p>
            <div className="grid grid-2" style={{ marginTop: 12 }}>
              <div>
                <h3 className="small">Ce qui est établi</h3>
                {summary.established.length ? (
                  <ul className="small" style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {summary.established.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                ) : (
                  <p className="small muted">Rien à ce jour.</p>
                )}
              </div>
              <div>
                <h3 className="small">Ce qui reste à prouver</h3>
                {summary.unproven.length ? (
                  <ul className="small" style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {summary.unproven.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                ) : (
                  <p className="small muted">
                    Rien de contredit pour l'instant — faute de paris réglés à examiner.
                  </p>
                )}
              </div>
            </div>
            {summary.actions.length > 0 && (
              <div className="notice" style={{ marginTop: 12 }}>
                <strong>À faire ensuite</strong>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  {summary.actions.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-4">
            <StatTile
              label="Score de Brier — modèle"
              value={report.brier_model === null ? '—' : nf(report.brier_model, 4)}
              sub={`marché : ${report.brier_market === null ? '—' : nf(report.brier_market, 4)} · plus bas est meilleur`}
            />
            <StatTile
              label="Gain sur le marché"
              value={report.brier_skill_score === null ? '—' : `${signed(report.brier_skill_score * 100, 2)} %`}
              delta={report.brier_skill_score}
              deltaLabel={report.brier_skill_score > 0 ? 'modèle devant' : 'marché devant'}
              sub="skill score : écart relatif au score du marché"
            />
            <StatTile
              label="Poids marché optimal"
              value={report.optimal_market_weight === null ? '—' : nf(report.optimal_market_weight, 2)}
              sub={
                report.optimal_market_weight === null
                  ? 'mesuré sur vos données'
                  : `soit ${pct(1 - report.optimal_market_weight, 0)} de voix au modèle`
              }
            />
            <StatTile
              label="Prévisions évaluées"
              value={report.sample}
              sub={`${data.coverage.without_odds} sans cotes · ${data.coverage.voided} remboursées`}
            />
          </div>

          <div className="split">
            <div className="card">
              <div className="card-head">
                <h2>Courbe de fiabilité</h2>
                <span className="hint">modèle contre marché, sur {report.sample} prévisions</span>
              </div>
              <div style={{ maxWidth: 460, margin: '0 auto' }}>
                <ReliabilityCurve
                  model={report.reliability_model}
                  market={report.reliability_market}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Combien de paris pour trancher ?</h2>
                <span className="hint">à 95 % de confiance</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Avantage supposé</th><th className="num">Paris nécessaires</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2 %</td>
                      <td className="num"><strong>{data.sample_size_required.edge_2pct ?? '—'}</strong></td>
                    </tr>
                    <tr>
                      <td>5 %</td>
                      <td className="num"><strong>{data.sample_size_required.edge_5pct ?? '—'}</strong></td>
                    </tr>
                    <tr>
                      <td>10 %</td>
                      <td className="num"><strong>{data.sample_size_required.edge_10pct ?? '—'}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="card-note">
                Calcul fait à la cote moyenne de {nf(data.sample_size_required.reference_odds)}.
                C'est l'ordre de grandeur qui compte : un ROI positif sur une saison
                de paris ne prouve presque jamais un avantage. Le CLV, lui, conclut
                en quelques dizaines de paris.
              </div>

              <div className="card-head" style={{ marginTop: 18 }}>
                <h3>Vos résultats à ce jour</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    <tr>
                      <td>Yield</td>
                      <td className="num">
                        {data.yield_test.mean_pct === null ? '—' : `${signed(data.yield_test.mean_pct, 2)} %`}
                      </td>
                      <td className="small muted wrap">{data.yield_test.message}</td>
                    </tr>
                    <tr>
                      <td>CLV</td>
                      <td className="num">
                        {data.clv.mean_pct === null ? '—' : `${signed(data.clv.mean_pct, 2)} %`}
                      </td>
                      <td className="small muted wrap">{data.clv.message}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Et si je me trompais ? — simulation de risque</h2>
            <div className="small muted">
              La mise se dimensionne sur l'avantage que l'on <em>croit</em> détenir ;
              le capital, lui, suit l'avantage <em>réel</em>. Faites diverger les deux.
            </div>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="sim-believed">Avantage supposé</label>
            <select
              id="sim-believed" value={simParams.believed_edge}
              onChange={e => setSimParams({ ...simParams, believed_edge: Number(e.target.value) })}
            >
              {[0.0, 0.02, 0.03, 0.04, 0.06, 0.10].map(v => (
                <option key={v} value={v}>{(v * 100).toFixed(0)} %</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sim-true">Avantage réel</label>
            <select
              id="sim-true" value={simParams.true_edge}
              onChange={e => setSimParams({ ...simParams, true_edge: Number(e.target.value) })}
            >
              {[-0.06, -0.04, -0.02, 0.0, 0.01, 0.02, 0.05].map(v => (
                <option key={v} value={v}>{(v * 100).toFixed(0)} %</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sim-bets">Nombre de paris</label>
            <select
              id="sim-bets" value={simParams.n_bets}
              onChange={e => setSimParams({ ...simParams, n_bets: Number(e.target.value) })}
            >
              {[100, 250, 500, 1000, 2000].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sim-odds">Cote moyenne</label>
            <select
              id="sim-odds" value={simParams.odds}
              onChange={e => setSimParams({ ...simParams, odds: Number(e.target.value) })}
            >
              {[1.5, 1.9, 2.0, 2.5, 3.0, 4.0].map(v => <option key={v} value={v}>{v.toFixed(2)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sim-staking">Gestion de mise</label>
            <select
              id="sim-staking" value={simParams.staking}
              onChange={e => setSimParams({ ...simParams, staking: e.target.value })}
            >
              <option value="kelly">Kelly fractionné</option>
              <option value="flat">Mise fixe</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sim-bankroll">Capital (€)</label>
            <input
              id="sim-bankroll" type="number" min="100" step="100" value={simParams.bankroll}
              onChange={e => setSimParams({ ...simParams, bankroll: Number(e.target.value) })}
            />
          </div>
          <button className="primary" onClick={runSimulation} disabled={simLoading}>
            {simLoading ? 'Simulation…' : 'Simuler'}
          </button>
        </div>

        {sim && (
          <>
            <div className="notice" style={{ marginBottom: 16 }}>{sim.message}</div>
            <div className="grid grid-4">
              <StatTile
                label="Capital médian"
                value={money(sim.final_bankroll.median, 0)}
                delta={sim.final_bankroll.median - sim.assumptions.bankroll}
                deltaLabel={`${signed((sim.final_bankroll.median / sim.assumptions.bankroll - 1) * 100, 1)} %`}
                sub={`mise appliquée : ${pct(sim.assumptions.stake_pct, 2)} du capital`}
              />
              <StatTile
                label="Probabilité de finir en perte"
                value={pct(sim.probability_of_loss, 0)}
                sub={`sur ${sim.assumptions.n_paths} trajectoires de ${sim.assumptions.n_bets} paris`}
              />
              <StatTile
                label="Recul de plus de 20 %"
                value={pct(sim.drawdown.over_20pct, 0)}
                sub={`recul médian ${nf(sim.drawdown.median_pct, 1)} % · pire ${nf(sim.drawdown.worst_pct, 1)} %`}
              />
              <StatTile
                label="Fourchette à 90 %"
                value={`${money(sim.final_bankroll.p05, 0)} → ${money(sim.final_bankroll.p95, 0)}`}
                sub="9 trajectoires sur 10 finissent dans cet intervalle"
              />
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-head">
                <h3>Où finissent les {sim.assumptions.n_paths} trajectoires</h3>
                <span className="hint">
                  avantage supposé {nf(sim.assumptions.believed_edge_pct, 0)} % ·
                  réel {nf(sim.assumptions.true_edge_pct, 0)} %
                </span>
              </div>
              <OutcomeDistribution
                histogram={sim.histogram}
                bankroll={sim.assumptions.bankroll}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
