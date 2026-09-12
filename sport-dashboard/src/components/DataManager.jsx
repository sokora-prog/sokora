import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { dateTime, marketLabel, nf } from '../lib/format.js';

/** Marchés proposés à la saisie manuelle des cotes. */
const ODDS_TEMPLATES = {
  '1X2': ['HOME', 'DRAW', 'AWAY'],
  'OU_2.5': ['OVER', 'UNDER'],
  'OU_1.5': ['OVER', 'UNDER'],
  'OU_3.5': ['OVER', 'UNDER'],
  BTTS: ['YES', 'NO'],
  DOUBLE_CHANCE: ['1X', '12', 'X2'],
  'AH_-0.5': ['HOME', 'AWAY'],
  'AH_-1.0': ['HOME', 'AWAY'],
  'AH_0.5': ['HOME', 'AWAY'],
  'AH_1.0': ['HOME', 'AWAY'],
};

const CSV_EXAMPLE = `date,home,away,home_goals,away_goals
2026-08-12,AS Kolomba,FC Bandama,2,1
2026-08-19,FC Bandama,US Bouaké,0,0`;

export default function DataManager({ competitions, teams, onChanged }) {
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState(null);

  const [competitionDraft, setCompetitionDraft] = useState({ name: '', season: '', country: '' });
  const [importDraft, setImportDraft] = useState({ competition_id: '', competition_name: '', season: '', csv_text: '' });
  const [matchDraft, setMatchDraft] = useState({
    competition_id: '', home_team: '', away_team: '', kickoff: '', home_goals: '', away_goals: '',
  });
  const [oddsDraft, setOddsDraft] = useState({ match_id: '', market: '1X2', bookmaker: '', values: {}, is_closing: false });
  const [scheduled, setScheduled] = useState([]);
  const [existingOdds, setExistingOdds] = useState(null);

  useEffect(() => {
    sportApi.matches({ status: 'SCHEDULED', limit: 200 })
      .then(r => setScheduled(r.data))
      .catch(() => setScheduled([]));
  }, [competitions, teams]);

  useEffect(() => {
    if (!oddsDraft.match_id) { setExistingOdds(null); return; }
    sportApi.odds(oddsDraft.match_id)
      .then(r => setExistingOdds(r.data))
      .catch(() => setExistingOdds(null));
  }, [oddsDraft.match_id, flash]);

  const report = (message, err) => {
    setFlash(err ? null : message);
    setError(err ? errorMessage(err) : null);
    if (!err) onChanged?.();
  };

  const createCompetition = async event => {
    event.preventDefault();
    try {
      await sportApi.createCompetition({
        name: competitionDraft.name,
        season: competitionDraft.season || null,
        country: competitionDraft.country || null,
      });
      setCompetitionDraft({ name: '', season: '', country: '' });
      report('Compétition créée.');
    } catch (e) { report(null, e); }
  };

  const runImport = async event => {
    event.preventDefault();
    try {
      const body = { csv_text: importDraft.csv_text };
      if (importDraft.competition_id) body.competition_id = Number(importDraft.competition_id);
      else {
        body.competition_name = importDraft.competition_name;
        body.season = importDraft.season || null;
      }
      const r = await sportApi.importCsv(body);
      report(
        `${r.data.created} match(s) importé(s), ${r.data.skipped} ignoré(s)` +
        (r.data.errors?.length ? ` — ${r.data.errors.join(' · ')}` : '')
      );
      setImportDraft({ ...importDraft, csv_text: '' });
    } catch (e) { report(null, e); }
  };

  const createMatch = async event => {
    event.preventDefault();
    try {
      const body = {
        competition_id: Number(matchDraft.competition_id),
        home_team: matchDraft.home_team,
        away_team: matchDraft.away_team,
      };
      if (matchDraft.kickoff) body.kickoff = new Date(matchDraft.kickoff).toISOString();
      if (matchDraft.home_goals !== '' && matchDraft.away_goals !== '') {
        body.home_goals = Number(matchDraft.home_goals);
        body.away_goals = Number(matchDraft.away_goals);
      }
      await sportApi.createMatch(body);
      setMatchDraft({ ...matchDraft, home_team: '', away_team: '', home_goals: '', away_goals: '' });
      report('Match enregistré.');
    } catch (e) { report(null, e); }
  };

  const saveOdds = async event => {
    event.preventDefault();
    const selections = ODDS_TEMPLATES[oddsDraft.market];
    const quotes = selections
      .filter(selection => oddsDraft.values[selection])
      .map(selection => ({
        market: oddsDraft.market,
        selection,
        odds: Number(oddsDraft.values[selection]),
        bookmaker: oddsDraft.bookmaker || null,
        is_closing: oddsDraft.is_closing,
      }));
    if (!quotes.length) { report(null, new Error('Aucune cote saisie')); return; }
    try {
      await sportApi.addOdds(oddsDraft.match_id, { quotes });
      setOddsDraft({ ...oddsDraft, values: {} });
      report(`${quotes.length} cote(s) enregistrée(s).`);
    } catch (e) { report(null, e); }
  };

  return (
    <div className="stack">
      {flash && <div className="notice ok">{flash}</div>}
      {error && <div className="notice error">{error}</div>}

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Import de matchs (CSV)</h2>
            <span className="hint">la voie la plus rapide pour alimenter le modèle</span>
          </div>
          <form className="stack" onSubmit={runImport}>
            <div className="row">
              <div className="field">
                <label htmlFor="imp-comp">Compétition existante</label>
                <select
                  id="imp-comp" value={importDraft.competition_id}
                  onChange={e => setImportDraft({ ...importDraft, competition_id: e.target.value })}
                >
                  <option value="">— nouvelle compétition —</option>
                  {competitions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.season ? ` (${c.season})` : ''}</option>
                  ))}
                </select>
              </div>
              {!importDraft.competition_id && (
                <>
                  <div className="field">
                    <label htmlFor="imp-name">Nom de la compétition</label>
                    <input
                      id="imp-name" required value={importDraft.competition_name}
                      onChange={e => setImportDraft({ ...importDraft, competition_name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="imp-season">Saison</label>
                    <input
                      id="imp-season" placeholder="2026/2027" value={importDraft.season}
                      onChange={e => setImportDraft({ ...importDraft, season: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="field" style={{ minWidth: 0 }}>
              <label htmlFor="imp-csv">Données CSV</label>
              <textarea
                id="imp-csv" required value={importDraft.csv_text}
                placeholder={CSV_EXAMPLE}
                onChange={e => setImportDraft({ ...importDraft, csv_text: e.target.value })}
              />
            </div>
            <div className="btn-row">
              <button className="primary" type="submit">Importer</button>
              <button
                type="button" className="ghost"
                onClick={() => setImportDraft({ ...importDraft, csv_text: CSV_EXAMPLE })}
              >
                Insérer un exemple
              </button>
            </div>
          </form>
          <div className="card-note">
            Colonnes requises : <span className="mono">home, away, home_goals, away_goals</span>.
            Facultatives : <span className="mono">date, matchday, home_xg, away_xg, home_shots,
            away_shots, home_corners, away_corners</span>. Les noms du format
            football-data.co.uk sont reconnus (<span className="mono">HomeTeam, AwayTeam, FTHG,
            FTAG, HS, AS, HC, AC</span>), séparateur <span className="mono">,</span> ou{' '}
            <span className="mono">;</span>. Les équipes inconnues sont créées, et un
            même match ne peut pas être importé deux fois.
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Nouvelle compétition</h2></div>
            <form className="row" onSubmit={createCompetition}>
              <div className="field">
                <label htmlFor="comp-name">Nom</label>
                <input
                  id="comp-name" required value={competitionDraft.name}
                  onChange={e => setCompetitionDraft({ ...competitionDraft, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="comp-season">Saison</label>
                <input
                  id="comp-season" placeholder="2026/2027" value={competitionDraft.season}
                  onChange={e => setCompetitionDraft({ ...competitionDraft, season: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="comp-country">Pays</label>
                <input
                  id="comp-country" value={competitionDraft.country}
                  onChange={e => setCompetitionDraft({ ...competitionDraft, country: e.target.value })}
                />
              </div>
              <button className="primary" type="submit">Créer</button>
            </form>
            {competitions.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Compétition</th><th>Saison</th>
                      <th className="num">Équipes</th><th className="num">Matchs joués</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitions.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.season || '—'}</td>
                        <td className="num">{c.teams_count}</td>
                        <td className="num">{c.finished_count} / {c.matches_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Nouveau match</h2>
              <span className="hint">laisser le score vide pour un match à venir</span>
            </div>
            <form className="row" onSubmit={createMatch}>
              <div className="field">
                <label htmlFor="m-comp">Compétition</label>
                <select
                  id="m-comp" required value={matchDraft.competition_id}
                  onChange={e => setMatchDraft({ ...matchDraft, competition_id: e.target.value })}
                >
                  <option value="">Choisir…</option>
                  {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="m-home">Domicile</label>
                <input
                  id="m-home" required list="team-names" value={matchDraft.home_team}
                  onChange={e => setMatchDraft({ ...matchDraft, home_team: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="m-away">Extérieur</label>
                <input
                  id="m-away" required list="team-names" value={matchDraft.away_team}
                  onChange={e => setMatchDraft({ ...matchDraft, away_team: e.target.value })}
                />
              </div>
              <datalist id="team-names">
                {teams.map(t => <option key={t.id} value={t.name} />)}
              </datalist>
              <div className="field">
                <label htmlFor="m-kickoff">Coup d'envoi</label>
                <input
                  id="m-kickoff" type="datetime-local" value={matchDraft.kickoff}
                  onChange={e => setMatchDraft({ ...matchDraft, kickoff: e.target.value })}
                />
              </div>
              <div className="field" style={{ maxWidth: 90 }}>
                <label htmlFor="m-hg">Buts dom.</label>
                <input
                  id="m-hg" type="number" min="0" value={matchDraft.home_goals}
                  onChange={e => setMatchDraft({ ...matchDraft, home_goals: e.target.value })}
                />
              </div>
              <div className="field" style={{ maxWidth: 90 }}>
                <label htmlFor="m-ag">Buts ext.</label>
                <input
                  id="m-ag" type="number" min="0" value={matchDraft.away_goals}
                  onChange={e => setMatchDraft({ ...matchDraft, away_goals: e.target.value })}
                />
              </div>
              <button className="primary" type="submit">Enregistrer</button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Cotes des bookmakers</h2>
          <span className="hint">sans cotes, aucune valeur ne peut être mesurée</span>
        </div>
        <form className="row" onSubmit={saveOdds}>
          <div className="field" style={{ minWidth: 260 }}>
            <label htmlFor="o-match">Match à venir</label>
            <select
              id="o-match" required value={oddsDraft.match_id}
              onChange={e => setOddsDraft({ ...oddsDraft, match_id: e.target.value })}
            >
              <option value="">Choisir…</option>
              {scheduled.map(m => (
                <option key={m.id} value={m.id}>
                  {m.home_team} — {m.away_team} ({dateTime(m.kickoff)})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="o-market">Marché</label>
            <select
              id="o-market" value={oddsDraft.market}
              onChange={e => setOddsDraft({ ...oddsDraft, market: e.target.value, values: {} })}
            >
              {Object.keys(ODDS_TEMPLATES).map(market => (
                <option key={market} value={market}>{market}</option>
              ))}
            </select>
          </div>
          {ODDS_TEMPLATES[oddsDraft.market].map(selection => (
            <div className="field" style={{ maxWidth: 130 }} key={selection}>
              <label htmlFor={`o-${selection}`}>{marketLabel(oddsDraft.market, selection)}</label>
              <input
                id={`o-${selection}`} type="number" step="0.01" min="1.01"
                value={oddsDraft.values[selection] || ''}
                onChange={e => setOddsDraft({
                  ...oddsDraft, values: { ...oddsDraft.values, [selection]: e.target.value },
                })}
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="o-book">Bookmaker</label>
            <input
              id="o-book" value={oddsDraft.bookmaker}
              onChange={e => setOddsDraft({ ...oddsDraft, bookmaker: e.target.value })}
            />
          </div>
          <div className="field" style={{ maxWidth: 150 }}>
            <label htmlFor="o-closing">Cote de clôture</label>
            <select
              id="o-closing" value={oddsDraft.is_closing ? '1' : ''}
              onChange={e => setOddsDraft({ ...oddsDraft, is_closing: e.target.value === '1' })}
            >
              <option value="">Non</option>
              <option value="1">Oui</option>
            </select>
          </div>
          <button className="primary" type="submit">Enregistrer</button>
        </form>

        {existingOdds && Object.keys(existingOdds.markets).length > 0 && (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Marché</th><th>Sélection</th><th className="num">Cote</th>
                  <th>Bookmaker</th><th className="num">Marge du marché</th><th />
                </tr>
              </thead>
              <tbody>
                {Object.entries(existingOdds.markets).flatMap(([market, rows]) =>
                  rows.map(row => (
                    <tr key={row.id}>
                      <td className="muted">{market}</td>
                      <td>{marketLabel(market, row.selection)}{row.is_closing ? ' (clôture)' : ''}</td>
                      <td className="num">{nf(row.odds)}</td>
                      <td>{row.bookmaker || '—'}</td>
                      <td
                        className="num"
                        title={(existingOdds.margin_detail?.[market] || [])
                          .map(d => `${d.bookmaker}${d.is_closing ? ' (clôture)' : ''} : ${nf(d.margin * 100, 2)} %`)
                          .join('\n')}
                      >
                        {existingOdds.margins[market] != null
                          ? `${nf(existingOdds.margins[market] * 100, 2)} %`
                          : '—'}
                      </td>
                      <td>
                        <button
                          className="ghost danger"
                          onClick={async () => {
                            await sportApi.deleteOdds(row.id);
                            setFlash('Cote supprimée.');
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-note">
          Enregistrez toutes les sélections d'un marché : c'est la seule façon de
          retirer la marge du bookmaker et d'obtenir sa vraie probabilité. Une marge
          supérieure à 7 % rend la valeur très difficile à trouver sur ce marché.
          La marge affichée est la plus faible parmi les bookmakers enregistrés
          (survolez-la pour le détail).
        </div>
      </div>
    </div>
  );
}
