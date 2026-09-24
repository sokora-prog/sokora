/**
 * Composants de data-visualisation.
 *
 * Règles appliquées partout :
 *  - couleurs de séries assignées dans un ordre fixe (jamais recyclées),
 *  - traits fins, grille en filet discret, extrémités arrondies,
 *  - une légende dès deux séries, valeurs étiquetées directement,
 *  - survol avec infobulle sur chaque marque,
 *  - une vue tableau repliée sous chaque graphique (lecture sans couleur).
 */

import React, { useEffect, useRef, useState } from 'react';
import { nf, money, pct, signed } from '../lib/format.js';

/** Largeur observée d'un conteneur, pour dessiner un SVG à l'échelle réelle. */
function useWidth(fallback = 720) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect?.width;
      if (measured) setWidth(measured);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export function StatTile({ label, value, sub, delta, deltaLabel }) {
  const tone = delta === undefined || delta === null
    ? null
    : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {tone && (
        <span className={`delta ${tone}`}>
          <span aria-hidden="true">{tone === 'up' ? '▲' : tone === 'down' ? '▼' : '▬'}</span>
          {deltaLabel}
        </span>
      )}
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

export function DataTable({ summary, headers, rows }) {
  if (!rows?.length) return null;
  return (
    <details className="card-note">
      <summary style={{ cursor: 'pointer' }}>{summary || 'Voir les données'}</summary>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>{headers.map(h => <th key={h} className="num">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j} className="num">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Courbe de bankroll — une seule série, donc aucune légende : le titre nomme
 * la donnée. Réticule + infobulle au survol, dernier point étiqueté.
 */
export function BankrollCurve({ points, height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);

  if (!points || points.length < 2) {
    return <div className="empty">Pas encore assez de paris réglés pour tracer la courbe.</div>;
  }

  const pad = { top: 14, right: 62, bottom: 26, left: 56 };
  const innerW = Math.max(60, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const values = points.map(p => p.bankroll);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.1);
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;

  const x = i => pad.left + (i / (points.length - 1)) * innerW;
  const y = v => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.bankroll).toFixed(1)}`).join(' ');
  const ticks = [lo, lo + (hi - lo) / 2, hi];
  const last = points[points.length - 1];
  const start = points[0].bankroll;

  const onMove = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - box.left;
    const index = Math.round(((position - pad.left) / innerW) * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, index));
    setHover(clamped);
  };

  return (
    <div className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Évolution de la bankroll pari après pari"
      >
        {ticks.map(tick => (
          <g key={tick}>
            <line className="grid-line" x1={pad.left} x2={pad.left + innerW} y1={y(tick)} y2={y(tick)} />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end">{nf(tick, 0)}</text>
          </g>
        ))}
        {/* Repère du capital de départ : au-dessus = en profit. */}
        <line
          x1={pad.left} x2={pad.left + innerW} y1={y(start)} y2={y(start)}
          stroke="var(--axis)" strokeWidth="1"
        />
        <line className="axis-line" x1={pad.left} x2={pad.left + innerW}
              y1={pad.top + innerH} y2={pad.top + innerH} />
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last.bankroll)} r="4"
                fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
        <text x={x(points.length - 1) + 9} y={y(last.bankroll) + 4}
              style={{ fill: 'var(--ink)', fontWeight: 600 }}>
          {nf(last.bankroll, 0)} €
        </text>
        {hover !== null && (
          <g>
            <line className="grid-line" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} />
            <circle cx={x(hover)} cy={y(points[hover].bankroll)} r="4"
                    fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
          </g>
        )}
        <text x={pad.left} y={height - 6}>pari 1</text>
        <text x={pad.left + innerW} y={height - 6} textAnchor="end">
          pari {points.length - 1}
        </text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: x(hover), top: y(points[hover].bankroll) }}>
          <div>{points[hover].label || `Pari ${hover}`}</div>
          <div>
            Bankroll <strong>{money(points[hover].bankroll)}</strong>
          </div>
          <div className="muted">
            Cumul {signed(points[hover].profit)} €
            {points[hover].result ? ` · ${points[hover].result}` : ''}
          </div>
        </div>
      )}
      <DataTable
        summary="Voir les données de la courbe"
        headers={['Pari', 'Libellé', 'Résultat', 'Cumul', 'Bankroll']}
        rows={points.slice(1).map(p => [
          p.index, p.label || '—', p.result || '—', signed(p.profit), nf(p.bankroll),
        ])}
      />
    </div>
  );
}

/**
 * Comparaison probabilité du modèle / probabilité du marché sur un même axe.
 * Deux séries → légende obligatoire, et chaque valeur est écrite en clair.
 */
export function ProbabilityBars({ rows, showMarket = true }) {
  if (!rows?.length) return <div className="empty">Aucune probabilité à afficher.</div>;
  const max = Math.max(...rows.flatMap(r => [r.model || 0, r.market || 0]), 0.05);

  return (
    <div>
      {showMarket && (
        <div className="legend" style={{ marginBottom: 10 }}>
          <span className="legend-item">
            <span className="swatch" style={{ background: 'var(--series-1)' }} />Modèle
          </span>
          <span className="legend-item">
            <span className="swatch" style={{ background: 'var(--series-2)' }} />
            Marché (cotes sans marge)
          </span>
        </div>
      )}
      {rows.map(row => (
        <div className="bar-row" key={row.label}>
          <span className="bar-label">{row.label}</span>
          <div className="bar-track">
            <div className="bar-line" title={`Modèle : ${pct(row.model)}`}>
              <span
                className="bar-fill"
                style={{ width: `${(row.model / max) * 100}%`, background: 'var(--series-1)' }}
              />
              <span className="bar-value">
                {pct(row.model)}{row.modelOdds ? ` · cote juste ${nf(row.modelOdds)}` : ''}
              </span>
            </div>
            {showMarket && row.market !== null && row.market !== undefined && (
              <div className="bar-line" title={`Marché : ${pct(row.market)}`}>
                <span
                  className="bar-fill"
                  style={{ width: `${(row.market / max) * 100}%`, background: 'var(--series-2)' }}
                />
                <span className="bar-value">
                  {pct(row.market)}{row.marketOdds ? ` · cote ${nf(row.marketOdds)}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      <DataTable
        summary="Voir les données du graphique"
        headers={['Sélection', 'Modèle', 'Cote juste', 'Marché', 'Cote offerte']}
        rows={rows.map(r => [
          r.label, pct(r.model), r.modelOdds ? nf(r.modelOdds) : '—',
          r.market != null ? pct(r.market) : '—', r.marketOdds ? nf(r.marketOdds) : '—',
        ])}
      />
    </div>
  );
}

/** Carte de chaleur des scores exacts — rampe séquentielle à une seule teinte. */
export function ScoreHeatmap({ matrix, homeName, awayName }) {
  const rows = matrix?.rows;
  if (!rows?.length) return null;
  const flat = rows.flat();
  const max = Math.max(...flat);
  const steps = ['--seq-100', '--seq-200', '--seq-300', '--seq-400', '--seq-500', '--seq-600'];

  const colour = value => {
    if (max <= 0) return 'var(--surface-2)';
    const ratio = value / max;
    const index = Math.min(steps.length - 1, Math.floor(ratio * steps.length));
    return `var(${steps[index]})`;
  };
  // Les deux derniers pas de la rampe sont sombres : l'encre passe en clair.
  const ink = value => (value / max > 0.66 ? '#fcfcfb' : 'var(--ink)');

  const size = rows.length;
  return (
    <div>
      <div className="scale-legend" style={{ marginBottom: 10 }}>
        <span>rare</span>
        <span className="scale-steps">
          {steps.map(step => <span key={step} style={{ background: `var(${step})` }} />)}
        </span>
        <span>fréquent · probabilité du score exact</span>
      </div>
      <div
        className="heat-grid"
        style={{ gridTemplateColumns: `28px repeat(${size}, minmax(0, 1fr))` }}
      >
        <span />
        {rows.map((_, j) => <span className="heat-axis" key={`c${j}`}>{j}</span>)}
        {rows.map((row, i) => (
          <React.Fragment key={`r${i}`}>
            <span className="heat-axis" style={{ alignSelf: 'center' }}>{i}</span>
            {row.map((value, j) => (
              <div
                className="heat-cell"
                key={`${i}-${j}`}
                style={{ background: colour(value), color: ink(value) }}
                title={`${homeName || 'Domicile'} ${i} — ${j} ${awayName || 'Extérieur'} : ${pct(value)}`}
              >
                {value >= 0.02 ? Math.round(value * 100) : ''}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="card-note">
        Buts du domicile en ligne, de l'extérieur en colonne. Valeurs en % (celles
        sous 2 % ne sont pas écrites). Scores au-delà de 5 buts :{' '}
        {pct(matrix.beyond || 0)}.
      </div>
    </div>
  );
}

/**
 * Barres divergentes autour de zéro (profit / ROI par marché) : deux teintes
 * opposées et un axe neutre au centre — la polarité est la donnée.
 */
export function DivergingBars({ rows, unit = '€' }) {
  if (!rows?.length) return <div className="empty">Aucun pari réglé à ventiler.</div>;
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 1);

  return (
    <div>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--series-1)' }} />Gain
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--critical)' }} />Perte
        </span>
      </div>
      {rows.map(row => {
        const ratio = Math.abs(row.value) / max;
        const positive = row.value >= 0;
        return (
          <div className="bar-row" key={row.label}>
            <span className="bar-label">{row.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {!positive && (
                    <span
                      className="bar-fill"
                      style={{
                        width: `${ratio * 100}%`, background: 'var(--critical)',
                        borderRadius: '4px 0 0 4px',
                      }}
                    />
                  )}
                </div>
                <span style={{ width: 1, background: 'var(--axis)', height: 15 }} />
                <div style={{ flex: 1 }}>
                  {positive && (
                    <span
                      className="bar-fill"
                      style={{ width: `${ratio * 100}%`, background: 'var(--series-1)' }}
                    />
                  )}
                </div>
              </div>
              <span
                className="bar-value"
                style={{ width: 132, textAlign: 'right', lineHeight: 1.35 }}
              >
                <strong>{signed(row.value)} {unit}</strong>
                {row.sub ? <><br />{row.sub}</> : null}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Série de résultats récents (W/D/L), la forme lue d'un coup d'œil. */
export function FormPills({ form }) {
  if (!form) return <span className="muted">—</span>;
  return (
    <span className="pills" title={`Forme (du plus récent au plus ancien) : ${form}`}>
      {form.split('').map((result, i) => (
        <span className={`pill ${result}`} key={i}>{result}</span>
      ))}
    </span>
  );
}
