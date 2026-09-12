import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import MatchAnalysis from './MatchAnalysis.jsx';
import { dateTime, nf } from '../lib/format.js';

const STATUS_LABEL = {
  SCHEDULED: 'À venir', FINISHED: 'Joué', LIVE: 'En cours',
  POSTPONED: 'Reporté', CANCELLED: 'Annulé',
};

export default function Matches({ competitions, selectedMatchId, onSelectMatch, onChanged }) {
  const [filters, setFilters] = useState({ competition_id: '', status: 'SCHEDULED' });
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [resultDraft, setResultDraft] = useState(null);

  const load = () => {
    const params = { limit: 200 };
    if (filters.competition_id) params.competition_id = filters.competition_id;
    if (filters.status) params.status = filters.status;
    sportApi.matches(params)
      .then(r => { setMatches(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)));
  };

  useEffect(load, [filters]);

  const saveResult = async () => {
    try {
      const response = await sportApi.setResult(resultDraft.id, {
        home_goals: Number(resultDraft.home_goals),
        away_goals: Number(resultDraft.away_goals),
        settle_bets: true,
      });
      const settled = response.data.settled_bets?.length || 0;
      setResultDraft(null);
      load();
      onChanged?.();
      setError(settled ? `Score enregistré · ${settled} pari(s) réglé(s) automatiquement.` : null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="filter-comp">Compétition</label>
            <select
              id="filter-comp" value={filters.competition_id}
              onChange={e => setFilters({ ...filters, competition_id: e.target.value })}
            >
              <option value="">Toutes</option>
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.season ? ` (${c.season})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-status">État</label>
            <select
              id="filter-status" value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Tous</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button className="ghost" onClick={load}>Rafraîchir</button>
        </div>
      </div>

      {error && <div className="notice">{error}</div>}

      <div className="card">
        <div className="card-head">
          <h2>Matchs</h2>
          <span className="hint">{matches.length} résultat(s) · cliquer pour analyser</span>
        </div>
        {matches.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Coup d'envoi</th><th>Affiche</th><th>Compétition</th>
                  <th className="num">Score</th><th className="num">xG</th>
                  <th className="num">Cotes</th><th className="num">Paris</th><th />
                </tr>
              </thead>
              <tbody>
                {matches.map(match => (
                  <tr
                    key={match.id}
                    className={`clickable${match.id === selectedMatchId ? ' selected' : ''}`}
                    onClick={() => onSelectMatch(match.id)}
                  >
                    <td>{dateTime(match.kickoff)}</td>
                    <td>{match.home_team} — {match.away_team}</td>
                    <td className="muted">{match.competition}</td>
                    <td className="num">{match.score || '—'}</td>
                    <td className="num">
                      {match.home_xg ? `${nf(match.home_xg, 1)} / ${nf(match.away_xg, 1)}` : '—'}
                    </td>
                    <td className="num">{match.odds_count}</td>
                    <td className="num">{match.bets_count}</td>
                    <td>
                      {match.status === 'SCHEDULED' && (
                        <button
                          className="ghost"
                          onClick={event => {
                            event.stopPropagation();
                            setResultDraft({ id: match.id, label: `${match.home_team} — ${match.away_team}`, home_goals: 0, away_goals: 0 });
                          }}
                        >
                          Saisir le score
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Aucun match pour ce filtre. Ajoutez-en dans l'onglet «&nbsp;Données&nbsp;».
          </div>
        )}

        {resultDraft && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <div className="card-head"><h3>Score final — {resultDraft.label}</h3></div>
            <div className="row">
              <div className="field">
                <label htmlFor="hg">Buts domicile</label>
                <input
                  id="hg" type="number" min="0" value={resultDraft.home_goals}
                  onChange={e => setResultDraft({ ...resultDraft, home_goals: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="ag">Buts extérieur</label>
                <input
                  id="ag" type="number" min="0" value={resultDraft.away_goals}
                  onChange={e => setResultDraft({ ...resultDraft, away_goals: e.target.value })}
                />
              </div>
              <div className="btn-row">
                <button className="primary" onClick={saveResult}>Enregistrer</button>
                <button className="ghost" onClick={() => setResultDraft(null)}>Annuler</button>
              </div>
            </div>
            <div className="card-note">
              Les paris en cours sur ce match seront réglés automatiquement
              (les marchés non reconnus restent à régler à la main).
            </div>
          </div>
        )}
      </div>

      {selectedMatchId && <MatchAnalysis matchId={selectedMatchId} onPlaced={onChanged} />}
    </div>
  );
}
