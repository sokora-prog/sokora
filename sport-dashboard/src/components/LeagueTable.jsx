import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { FormPills, StatTile } from './charts.jsx';
import { dateShort, nf, pct } from '../lib/format.js';

export default function LeagueTable({ competitions }) {
  const [competitionId, setCompetitionId] = useState('');
  const [table, setTable] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!competitionId && competitions.length) setCompetitionId(String(competitions[0].id));
  }, [competitions]);

  useEffect(() => {
    if (!competitionId) return;
    setTeamId(null);
    setTeamStats(null);
    sportApi.table(competitionId)
      .then(r => { setTable(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)));
  }, [competitionId]);

  useEffect(() => {
    if (!teamId) return;
    sportApi.teamStats(teamId, 10)
      .then(r => setTeamStats(r.data))
      .catch(e => setError(errorMessage(e)));
  }, [teamId]);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h1>Championnat et forces d'équipe</h1>
          <span className="hint">cliquer sur une équipe pour sa fiche détaillée</span>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="lt-comp">Compétition</label>
            <select id="lt-comp" value={competitionId} onChange={e => setCompetitionId(e.target.value)}>
              {competitions.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.season ? ` (${c.season})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      {table && (
        <>
          <div className="grid grid-4">
            <StatTile label="Matchs joués" value={table.baseline.matches} />
            <StatTile
              label="Buts par match" value={nf(table.baseline.avg_total_goals)}
              sub={`${nf(table.baseline.avg_home_goals)} à domicile · ${nf(table.baseline.avg_away_goals)} à l'extérieur`}
            />
            <StatTile
              label="Avantage du terrain" value={`× ${nf(table.baseline.home_advantage)}`}
              sub="multiplicateur appliqué aux buts attendus du domicile"
            />
            <StatTile
              label="Équipes classées" value={table.table.length}
              sub="attaque et défense : 1,00 = niveau moyen"
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Classement enrichi</h2>
              <span className="hint">colonnes utiles au parieur, calculées depuis vos données</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th><th>Équipe</th>
                    <th className="num">J</th><th className="num">Pts</th><th className="num">Pts/M</th>
                    <th className="num">BP</th><th className="num">BC</th><th className="num">Diff</th>
                    <th className="num">Pts/M dom.</th><th className="num">Pts/M ext.</th>
                    <th className="num">+2,5 buts</th><th className="num">2 marquent</th>
                    <th className="num">Attaque</th><th className="num">Défense</th>
                    <th>Forme</th>
                  </tr>
                </thead>
                <tbody>
                  {table.table.map(row => (
                    <tr
                      key={row.team_id}
                      className={`clickable${row.team_id === teamId ? ' selected' : ''}`}
                      onClick={() => setTeamId(row.team_id)}
                    >
                      <td className="num">{row.rank}</td>
                      <td>{row.name}</td>
                      <td className="num">{row.played}</td>
                      <td className="num"><strong>{row.points}</strong></td>
                      <td className="num">{nf(row.ppg)}</td>
                      <td className="num">{row.goals_for}</td>
                      <td className="num">{row.goals_against}</td>
                      <td className="num">{row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}</td>
                      <td className="num">{nf(row.home_ppg)}</td>
                      <td className="num">{nf(row.away_ppg)}</td>
                      <td className="num">{pct(row.over25_rate)}</td>
                      <td className="num">{pct(row.btts_rate)}</td>
                      <td className="num">{nf(row.attack)}</td>
                      <td className="num">{nf(row.defense)}</td>
                      <td><FormPills form={row.form} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-note">
              Attaque supérieure à 1,00 : l'équipe marque plus que la moyenne à
              adversaire égal. Défense inférieure à 1,00 : elle encaisse moins.
              Ces deux nombres sont ceux qui pilotent les buts attendus.
            </div>
          </div>
        </>
      )}

      {teamStats && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2>{teamStats.team.name}</h2>
              <div className="small muted">
                Elo {nf(teamStats.elo, 0)} · attaque {nf(teamStats.strength?.attack ?? 1)} ·
                défense {nf(teamStats.strength?.defense ?? 1)} ·
                échantillon {teamStats.strength?.matches ?? 0} matchs
              </div>
            </div>
            <button className="ghost" onClick={() => { setTeamId(null); setTeamStats(null); }}>
              Fermer
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bloc</th><th className="num">J</th><th>Forme</th>
                  <th className="num">Pts/M</th><th className="num">Buts pour</th>
                  <th className="num">Buts contre</th><th className="num">+1,5</th>
                  <th className="num">+2,5</th><th className="num">+3,5</th>
                  <th className="num">2 marquent</th><th className="num">Sans encaisser</th>
                  <th className="num">Muette</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['10 derniers matchs', teamStats.form_overall],
                  ['À domicile', teamStats.form_home],
                  ["À l'extérieur", teamStats.form_away],
                  ['Saison entière', teamStats.season_overall],
                ].map(([label, block]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="num">{block.played}</td>
                    <td><FormPills form={block.form} /></td>
                    <td className="num">{nf(block.ppg)}</td>
                    <td className="num">{nf(block.avg_goals_for)}</td>
                    <td className="num">{nf(block.avg_goals_against)}</td>
                    <td className="num">{pct(block.over_rates?.['over_1.5'] ?? 0)}</td>
                    <td className="num">{pct(block.over_rates?.['over_2.5'] ?? 0)}</td>
                    <td className="num">{pct(block.over_rates?.['over_3.5'] ?? 0)}</td>
                    <td className="num">{pct(block.btts_rate)}</td>
                    <td className="num">{pct(block.clean_sheet_rate)}</td>
                    <td className="num">{pct(block.failed_to_score_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-head" style={{ marginTop: 18 }}>
            <h3>Derniers résultats</h3>
            <span className="hint">
              série en cours : {teamStats.form_overall.current_streak.length}{' '}
              {teamStats.form_overall.current_streak.type === 'W' ? 'victoire(s)'
                : teamStats.form_overall.current_streak.type === 'D' ? 'nul(s)' : 'défaite(s)'}
              {' '}· {teamStats.form_overall.unbeaten_run} match(s) sans défaite
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Lieu</th><th>Adversaire</th>
                  <th className="num">Score</th><th>Résultat</th><th className="num">Total buts</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.form_overall.last_results.map((row, i) => (
                  <tr key={i}>
                    <td>{dateShort(row.kickoff)}</td>
                    <td>{row.venue === 'HOME' ? 'Domicile' : 'Extérieur'}</td>
                    <td>{row.opponent}</td>
                    <td className="num">{row.score}</td>
                    <td><FormPills form={row.result} /></td>
                    <td className="num">{row.total_goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
