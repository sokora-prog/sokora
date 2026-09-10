import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { StatTile } from './charts.jsx';
import { dateTime, marketLabel, nf, pct, signed } from '../lib/format.js';

const SEGMENT_FAMILIES = [
  ['par_competition', 'Par compétition'],
  ['par_marche', 'Par marché'],
  ['par_affiche', "Par type d'affiche"],
  ['par_total_attendu', 'Par total attendu'],
];

const STATUS_TONE = {
  'AVANTAGE ÉTAYÉ': 'good',
  "PAS D'AVANTAGE": '',
  'ÉCHANTILLON TROP COURT': 'warning',
};

const VARIANT_LABEL = {
  goals: 'Buts marqués',
  shots: 'Tirs cadrés',
  xg: 'Buts attendus (xG)',
  blend: 'Mélange buts / tirs',
};

/**
 * Comparaison des scores de Brier : une seule série (les variantes) mesurée
 * contre un repère (le marché). Barre courte = meilleure prévision.
 */
function BrierBars({ rows, reference }) {
  const scored = rows.filter(r => r.brier != null);
  if (!scored.length) return null;
  const max = Math.max(...scored.map(r => r.brier), reference || 0) * 1.08;

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--series-1)' }} />
          Score de Brier du modèle — plus court est meilleur
        </span>
        <span className="legend-item">
          <span
            className="swatch"
            style={{ background: 'transparent', borderLeft: '2px solid var(--ink-2)', width: 2 }}
          />
          Cote de clôture ({reference != null ? nf(reference, 4) : '—'})
        </span>
      </div>
      {scored.map(row => (
        <div className="bar-row" key={row.variant}>
          <span className="bar-label">{VARIANT_LABEL[row.variant] || row.variant}</span>
          <div style={{ position: 'relative' }}>
            <div className="bar-line">
              <span
                className="bar-fill"
                style={{
                  width: `${(row.brier / max) * 100}%`,
                  background: row.beats_market ? 'var(--good)' : 'var(--series-1)',
                }}
              />
              <span className="bar-value">
                {nf(row.brier, 4)} · skill {signed(row.skill_pct, 2)} %
              </span>
            </div>
            {reference != null && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', top: -3, bottom: -3,
                  left: `${(reference / max) * 100}%`,
                  width: 2, background: 'var(--ink-2)',
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Laboratory({ competitions }) {
  const [params, setParams] = useState({ competition_id: '', market: '1X2', signal: 'shots' });
  const [bench, setBench] = useState(null);
  const [map, setMap] = useState(null);
  const [board, setBoard] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadBench = () => {
    setBusy(true);
    const query = { market: params.market, variants: 'goals,shots,xg,blend' };
    if (params.competition_id) query.competition_id = params.competition_id;
    sportApi.modelComparison(query)
      .then(r => { setBench(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  };

  const loadMap = () => {
    const query = { signal: params.signal };
    if (params.competition_id) query.competition_id = params.competition_id;
    sportApi.edgeMap(query)
      .then(r => setMap(r.data))
      .catch(e => setError(errorMessage(e)));
  };

  const loadJournal = () => {
    Promise.all([
      sportApi.forecastScoreboard({}),
      sportApi.forecasts({ pending_only: true, limit: 40 }),
    ])
      .then(([b, p]) => { setBoard(b.data); setPending(p.data); })
      .catch(e => setError(errorMessage(e)));
  };

  useEffect(loadBench, [params.competition_id, params.market]);
  useEffect(loadMap, [params.competition_id, params.signal]);
  useEffect(loadJournal, []);

  const freeze = async () => {
    setBusy(true);
    try {
      const body = {
        markets: ['1X2', 'OU_2.5'],
        signal: params.signal,
        market_weight: 0,
      };
      if (params.competition_id) body.competition_id = Number(params.competition_id);
      const r = await sportApi.snapshotForecasts(body);
      setFlash(
        r.data.created
          ? `${r.data.created} prévisions gelées sur ${r.data.matches_covered} match(s). `
            + 'Elles seront notées automatiquement à la saisie des scores.'
          : "Aucune nouvelle prévision : les matchs à venir sont déjà couverts, "
            + "ou n'ont pas de cotes enregistrées."
      );
      loadJournal();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h1>Laboratoire</h1>
            <div className="small muted">
              Trois questions, dans cet ordre : quelle façon de mesurer une équipe
              prédit le mieux, où se situe l'avantage s'il en existe un, et que
              vaut le modèle sur des matchs qu'il n'a jamais vus.
            </div>
          </div>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="lab-comp">Compétition</label>
            <select
              id="lab-comp" value={params.competition_id}
              onChange={e => setParams({ ...params, competition_id: e.target.value })}
            >
              <option value="">Toutes</option>
              {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lab-market">Marché du banc d'essai</label>
            <select
              id="lab-market" value={params.market}
              onChange={e => setParams({ ...params, market: e.target.value })}
            >
              {['1X2', 'OU_2.5', 'BTTS'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lab-signal">Signal des autres analyses</label>
            <select
              id="lab-signal" value={params.signal}
              onChange={e => setParams({ ...params, signal: e.target.value })}
            >
              {Object.entries(VARIANT_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <button className="ghost" onClick={loadBench} disabled={busy}>
            {busy ? 'Calcul…' : 'Recalculer'}
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {flash && <div className="notice ok">{flash}</div>}

      {/* ── 1. Banc d'essai ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Sur quoi mesurer la force d'une équipe ?</h2>
          <span className="hint">
            même historique, même cote de clôture — seule la mesure change
          </span>
        </div>
        {bench ? (
          <>
            <BrierBars rows={bench.variants} reference={bench.reference.brier} />
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Variante</th><th className="num">Couverture</th>
                    <th className="num">Prévisions</th><th className="num">Brier</th>
                    <th className="num">Log-loss</th><th className="num">Skill</th>
                    <th className="num">Poids marché optimal</th>
                  </tr>
                </thead>
                <tbody>
                  {bench.variants.map(row => (
                    <tr key={row.variant} className={row.variant === bench.best ? 'selected' : ''}>
                      <td>{VARIANT_LABEL[row.variant] || row.variant}</td>
                      <td className="num">{pct(row.coverage, 0)}</td>
                      <td className="num">{row.sample}</td>
                      <td className="num">{row.brier != null ? nf(row.brier, 5) : '—'}</td>
                      <td className="num">{row.log_loss != null ? nf(row.log_loss, 5) : '—'}</td>
                      <td
                        className="num"
                        style={{ color: row.skill_pct > 0 ? 'var(--good-text)' : 'var(--ink-2)' }}
                      >
                        {row.skill_pct != null ? `${signed(row.skill_pct, 2)} %` : '—'}
                      </td>
                      <td className="num">
                        {row.optimal_market_weight != null ? nf(row.optimal_market_weight, 2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="notice" style={{ marginTop: 12 }}>{bench.message}</div>
            <div className="card-note">{bench.note}</div>
          </>
        ) : <div className="empty">Calcul du banc d'essai…</div>}
      </div>

      {/* ── 2. Carte des avantages ──────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <h2>Où se situe l'avantage ?</h2>
          <span className="hint">
            {map ? `${map.sample} prévisions · ${map.comparisons} segments testés` : ''}
          </span>
        </div>
        {map ? (
          <>
            {map.demo_caveat && (
              <div className="notice" style={{ marginBottom: 12 }}>
                <strong>Données de démonstration</strong> — {map.demo_caveat}
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Découpage</th><th>Segment</th>
                    <th className="num">Prévisions</th><th className="num">Skill</th>
                    <th className="num">p</th><th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {SEGMENT_FAMILIES.flatMap(([key, label]) =>
                    (map.segments[key] || []).map((row, index) => (
                      <tr key={`${key}-${row.segment}`}>
                        <td className="muted">{index === 0 ? label : ''}</td>
                        <td>{row.segment}</td>
                        <td className="num">{row.sample}</td>
                        <td
                          className="num"
                          style={{ color: row.skill_pct > 0 ? 'var(--good-text)' : 'var(--ink-2)' }}
                        >
                          {row.skill_pct != null ? `${signed(row.skill_pct, 2)} %` : '—'}
                        </td>
                        <td className="num">{row.p_value ?? '—'}</td>
                        <td>
                          <span className={`badge ${STATUS_TONE[row.status] ?? ''}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="notice" style={{ marginTop: 14 }}>{map.message}</div>
          </>
        ) : <div className="empty">Segmentation en cours…</div>}
      </div>

      {/* ── 3. Journal de prévisions ────────────────────────────────── */}
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Journal de prévisions</h2>
            <div className="small muted">
              La calibration rejoue le passé — mais ses réglages ont été choisis en
              connaissant ces données. Une prévision gelée avant le coup d'envoi,
              elle, ne peut plus être retouchée.
            </div>
          </div>
          <button className="primary" onClick={freeze} disabled={busy}>
            {busy ? 'Gel en cours…' : 'Geler les matchs à venir'}
          </button>
        </div>

        {board && (
          <>
            <div className="grid grid-4">
              <StatTile
                label="Prévisions gelées" value={board.frozen_total}
                sub={`${board.resolved} notées · ${board.pending} en attente`}
              />
              <StatTile
                label="Marchés exploitables" value={board.scored_matches}
                sub="prévisions complètes et non remboursées"
              />
              <StatTile
                label="Brier — modèle"
                value={board.report.brier_model != null ? nf(board.report.brier_model, 4) : '—'}
                sub={`marché : ${board.report.brier_market != null ? nf(board.report.brier_market, 4) : '—'}`}
              />
              <StatTile
                label="Skill en conditions réelles"
                value={
                  board.report.brier_skill_score != null
                    ? `${signed(board.report.brier_skill_score * 100, 2)} %` : '—'
                }
                delta={board.report.brier_skill_score}
                deltaLabel={board.report.verdict}
              />
            </div>
            <div className="notice" style={{ marginTop: 14 }}>
              {board.frozen_total === 0
                ? "Le journal est vide. Gelez les prévisions des matchs à venir : "
                  + "c'est la seule mesure qu'aucun réglage rétrospectif ne peut flatter."
                : board.resolved === 0
                  ? `${board.pending} prévision(s) en attente : le verdict viendra quand `
                    + 'ces matchs auront été joués et leurs scores saisis. Rien à conclure '
                    + "d'ici là — c'est précisément ce qui fait la valeur de cette mesure."
                  : board.report.message}
            </div>
            <div className="card-note">{board.note}</div>

            {pending.length > 0 && (
              <>
                <div className="card-head" style={{ marginTop: 18 }}>
                  <h3>En attente de résultat</h3>
                  <span className="hint">{pending.length} prévision(s)</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Match</th><th>Coup d'envoi</th><th>Sélection</th>
                        <th className="num">Modèle</th><th className="num">Marché</th>
                        <th className="num">Cote gelée</th><th>Signal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.slice(0, 20).map(row => (
                        <tr key={row.id}>
                          <td>{row.match}</td>
                          <td>{dateTime(row.kickoff)}</td>
                          <td>{marketLabel(row.market, row.selection)}</td>
                          <td className="num">{pct(row.model_probability)}</td>
                          <td className="num">
                            {row.market_probability != null ? pct(row.market_probability) : '—'}
                          </td>
                          <td className="num">{row.best_odds ? nf(row.best_odds) : '—'}</td>
                          <td className="muted">{VARIANT_LABEL[row.signal] || row.signal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
