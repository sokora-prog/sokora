import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { BankrollCurve, StatTile } from './charts.jsx';
import { dateShort, marketLabel, money, nf, pct, signed, statusLabel } from '../lib/format.js';

export default function Backtest({ competitions }) {
  const [params, setParams] = useState({
    competition_id: '', min_edge: 0.03, flat_stake: 10, min_history: 40, market_weight: 0.35,
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params.competition_id && competitions.length) {
      setParams(p => ({ ...p, competition_id: String(competitions[0].id) }));
    }
  }, [competitions]);

  const run = () => {
    if (!params.competition_id) return;
    setLoading(true);
    sportApi.backtest(params)
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h1>Backtest de la stratégie</h1>
          <span className="hint">
            chaque prévision n'utilise que les matchs antérieurs au coup d'envoi
          </span>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="bt-comp">Compétition</label>
            <select
              id="bt-comp" value={params.competition_id}
              onChange={e => setParams({ ...params, competition_id: e.target.value })}
            >
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bt-edge">Seuil de valeur</label>
            <select
              id="bt-edge" value={params.min_edge}
              onChange={e => setParams({ ...params, min_edge: Number(e.target.value) })}
            >
              {[0.01, 0.02, 0.03, 0.05, 0.08].map(v => (
                <option key={v} value={v}>{v * 100} %</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bt-stake">Mise fixe (€)</label>
            <input
              id="bt-stake" type="number" min="1" step="1" value={params.flat_stake}
              onChange={e => setParams({ ...params, flat_stake: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="bt-history">Historique minimal</label>
            <input
              id="bt-history" type="number" min="10" step="5" value={params.min_history}
              onChange={e => setParams({ ...params, min_history: Number(e.target.value) })}
            />
          </div>
          <button className="primary" onClick={run} disabled={loading}>
            {loading ? 'Simulation…' : 'Lancer le backtest'}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {data && (
        <>
          <div className="grid grid-4">
            <StatTile
              label="Paris simulés" value={data.simulated_bets}
              sub={`sur ${data.matches_available} matchs joués`}
            />
            <StatTile
              label="Profit" value={`${signed(data.performance.profit)} €`}
              delta={data.performance.profit}
              deltaLabel={`ROI ${pct(data.performance.roi)}`}
              sub={`${money(data.performance.staked)} misés à mise fixe`}
            />
            <StatTile
              label="Taux de réussite" value={pct(data.performance.win_rate)}
              sub={`cote moyenne ${nf(data.performance.avg_odds)}`}
            />
            <StatTile
              label="Repli maximal" value={money(data.performance.max_drawdown)}
              sub={`${data.performance.worst_losing_streak} pertes d'affilée`}
            />
          </div>

          {data.matches_without_odds > 0 && (
            <div className="notice">
              {data.matches_without_odds} matchs joués n'ont aucune cote enregistrée et
              n'ont donc pas pu être simulés. Un backtest n'a de valeur que si les cotes
              historiques sont saisies — sans elles, ce résultat n'est qu'indicatif.
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h2>Courbe simulée</h2>
              <span className="hint">départ à 0 €, mise fixe de {money(params.flat_stake)}</span>
            </div>
            <BankrollCurve points={data.performance.bankroll_curve} />
            <div className="card-note">{data.note}</div>
          </div>

          {data.bets.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>Paris simulés</h2>
                <span className="hint">100 derniers</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Match</th><th>Sélection</th>
                      <th className="num">Cote</th><th className="num">Edge</th>
                      <th className="num">Score</th><th>Résultat</th><th className="num">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bets.slice().reverse().map((bet, i) => (
                      <tr key={i}>
                        <td>{dateShort(bet.kickoff)}</td>
                        <td>{bet.match}</td>
                        <td>{marketLabel(bet.market, bet.selection)}</td>
                        <td className="num">{nf(bet.odds)}</td>
                        <td className="num">{signed(bet.edge_pct, 2)} %</td>
                        <td className="num">{bet.score}</td>
                        <td>{statusLabel[bet.result] || bet.result}</td>
                        <td
                          className="num"
                          style={{ color: bet.profit > 0 ? 'var(--good-text)' : bet.profit < 0 ? 'var(--critical)' : 'var(--ink-2)' }}
                        >
                          {signed(bet.profit)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
