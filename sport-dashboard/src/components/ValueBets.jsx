import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { confidenceTone, dateTime, marketLabel, money, nf, pct, signed } from '../lib/format.js';

export default function ValueBets({ competitions, onOpenMatch }) {
  const [params, setParams] = useState({ min_edge: 0.03, market_weight: 0.35, competition_id: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const query = { min_edge: params.min_edge, market_weight: params.market_weight, limit: 60 };
    if (params.competition_id) query.competition_id = params.competition_id;
    sportApi.valueBets(query)
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [params]);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h1>Opportunités de valeur</h1>
          <span className="hint">
            balayage de tous les matchs à venir disposant de cotes enregistrées
          </span>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="vb-comp">Compétition</label>
            <select
              id="vb-comp" value={params.competition_id}
              onChange={e => setParams({ ...params, competition_id: e.target.value })}
            >
              <option value="">Toutes</option>
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="vb-edge">Seuil de valeur</label>
            <select
              id="vb-edge" value={params.min_edge}
              onChange={e => setParams({ ...params, min_edge: Number(e.target.value) })}
            >
              <option value={0.01}>1 %</option>
              <option value={0.02}>2 %</option>
              <option value={0.03}>3 % (recommandé)</option>
              <option value={0.05}>5 %</option>
              <option value={0.08}>8 %</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="vb-weight">Poids du marché</label>
            <select
              id="vb-weight" value={params.market_weight}
              onChange={e => setParams({ ...params, market_weight: Number(e.target.value) })}
            >
              <option value={0}>0 % — modèle seul</option>
              <option value={0.35}>35 % — recommandé</option>
              <option value={0.5}>50 %</option>
              <option value={0.75}>75 %</option>
            </select>
          </div>
          <button className="ghost" onClick={load} disabled={loading}>
            {loading ? 'Analyse…' : 'Relancer le balayage'}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {data && (
        <div className="card">
          <div className="card-head">
            <h2>{data.count} sélection(s) au-dessus du seuil</h2>
            <span className="hint">
              {data.matches_scanned} matchs analysés · bankroll disponible {money(data.bankroll)}
            </span>
          </div>
          {data.opportunities.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Match</th><th>Coup d'envoi</th><th>Sélection</th><th>Bookmaker</th>
                    <th className="num">Cote</th><th className="num">Cote juste</th>
                    <th className="num">Edge</th><th className="num">Mise Kelly</th>
                    <th className="num">Buts attendus</th><th>Fiabilité</th>
                  </tr>
                </thead>
                <tbody>
                  {data.opportunities.map((bet, i) => (
                    <tr key={i} className="clickable" onClick={() => onOpenMatch(bet.match_id)}>
                      <td>{bet.match}</td>
                      <td>{dateTime(bet.kickoff)}</td>
                      <td>{marketLabel(bet.market, bet.selection)}</td>
                      <td>{bet.bookmaker || '—'}</td>
                      <td className="num">{nf(bet.odds)}</td>
                      <td className="num">{nf(bet.fair_odds)}</td>
                      <td className="num" style={{ color: 'var(--good-text)', fontWeight: 600 }}>
                        {signed(bet.edge_pct, 2)} %
                      </td>
                      <td className="num">{money(bet.kelly.stake)}</td>
                      <td className="num">
                        {nf(bet.expected_goals.home, 1)} – {nf(bet.expected_goals.away, 1)}
                      </td>
                      <td>
                        <span className={`badge ${confidenceTone[bet.confidence.label] || ''}`}>
                          {bet.confidence.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              Rien au-dessus du seuil actuel. C'est un résultat normal : la majorité
              des marchés sont correctement évalués, et ne pas parier est une décision.
            </div>
          )}
          <div className="card-note">
            La probabilité retenue mêle le modèle et la cote du bookmaker débarrassée
            de sa marge ({pct(params.market_weight, 0)} de poids marché). La mise
            proposée est un quart de Kelly, plafonnée à 5 % de la bankroll.
          </div>
        </div>
      )}
    </div>
  );
}
