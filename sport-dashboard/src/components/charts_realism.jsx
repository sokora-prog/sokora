/**
 * Graphiques propres à l'onglet Réalisme.
 *
 * Deux formes, deux métiers :
 *  - la courbe de fiabilité compare deux séries (modèle / marché) à une
 *    diagonale de référence → deux teintes catégorielles + légende ;
 *  - la distribution des capitaux finaux est une polarité (au-dessus ou en
 *    dessous du capital de départ) → deux teintes opposées et un axe neutre.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DataTable } from './charts.jsx';
import { money, nf, pct } from '../lib/format.js';

function useWidth(fallback = 560) {
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

/**
 * Courbe de fiabilité : « quand j'annonce 30 %, cela arrive-t-il 30 % du temps ? »
 * Un point sur la diagonale est bien calibré ; au-dessus, le modèle sous-estime.
 */
export function ReliabilityCurve({ model, market, height = 300 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);

  if (!model?.length) {
    return (
      <div className="empty">
        Aucune prévision confrontée à une cote : la fiabilité ne peut pas être tracée.
      </div>
    );
  }

  const pad = { top: 14, right: 16, bottom: 34, left: 44 };
  const size = Math.max(120, Math.min(width - pad.left - pad.right, height - pad.top - pad.bottom));
  const x = p => pad.left + p * size;
  const y = p => pad.top + size - p * size;

  const series = [
    { key: 'model', label: 'Modèle', color: 'var(--series-1)', rows: model },
    { key: 'market', label: 'Marché (cote sans marge)', color: 'var(--series-2)', rows: market || [] },
  ];
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const maxCount = Math.max(...model.map(r => r.count), 1);

  return (
    <div className="chart" ref={ref}>
      <div className="legend" style={{ marginBottom: 10 }}>
        {series.map(s => (
          <span className="legend-item" key={s.key}>
            <span className="swatch" style={{ background: s.color }} />{s.label}
          </span>
        ))}
        <span className="legend-item">
          <span
            className="swatch"
            style={{ background: 'transparent', borderTop: '2px dashed var(--axis)', height: 0, width: 14 }}
          />
          Calibration parfaite
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${size + pad.top + pad.bottom}`}
        height={size + pad.top + pad.bottom}
        role="img"
        aria-label="Courbe de fiabilité du modèle comparée au marché"
      >
        {ticks.map(t => (
          <g key={t}>
            <line className="grid-line" x1={pad.left} x2={pad.left + size} y1={y(t)} y2={y(t)} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end">{Math.round(t * 100)}</text>
            <text x={x(t)} y={size + pad.top + 18} textAnchor="middle">{Math.round(t * 100)}</text>
          </g>
        ))}
        {/* Diagonale de référence : la seule ligne pointillée de l'application,
            parce qu'elle n'est pas une donnée mais un idéal. */}
        <line
          x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)}
          stroke="var(--axis)" strokeWidth="1.5" strokeDasharray="4 4"
        />
        {series.map(s => (
          s.rows.length > 1 && (
            <path
              key={s.key}
              d={s.rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(r.predicted)},${y(r.observed)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
            />
          )
        ))}
        {series.map(s => s.rows.map((r, i) => (
          <circle
            key={`${s.key}-${i}`}
            cx={x(r.predicted)} cy={y(r.observed)}
            // Le rayon porte l'effectif de l'intervalle : un point isolé pèse peu.
            r={3 + 5 * Math.sqrt(r.count / maxCount)}
            fill={s.color} stroke="var(--surface-1)" strokeWidth="2"
            onMouseEnter={() => setHover({ ...r, series: s.label, color: s.color, cx: x(r.predicted), cy: y(r.observed) })}
            onMouseLeave={() => setHover(null)}
          />
        )))}
        <text x={pad.left + size / 2} y={size + pad.top + 32} textAnchor="middle">
          probabilité annoncée (%)
        </text>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.cx, top: hover.cy }}>
          <div>{hover.series}</div>
          <div>annoncé <strong>{pct(hover.predicted)}</strong></div>
          <div>observé <strong>{pct(hover.observed)}</strong> sur {hover.count} cas</div>
          <div className="muted">
            {hover.within_noise ? 'écart compatible avec le hasard' : 'écart supérieur au bruit'}
          </div>
        </div>
      )}
      <div className="card-note">
        Axe vertical : fréquence réellement observée. La taille des points reflète
        le nombre de prévisions dans l'intervalle.
      </div>
      <DataTable
        summary="Voir les données de la courbe"
        headers={['Intervalle', 'Annoncé', 'Observé', 'Écart', 'Effectif']}
        rows={model.map(r => [
          `${Math.round(r.lower * 100)}–${Math.round(r.upper * 100)} %`,
          pct(r.predicted), pct(r.observed),
          `${r.gap > 0 ? '+' : ''}${nf(r.gap * 100, 1)} pt`, r.count,
        ])}
      />
    </div>
  );
}

/** Distribution des capitaux finaux simulés, autour du capital de départ. */
export function OutcomeDistribution({ histogram, bankroll, height = 190 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  if (!histogram?.length) return null;

  const pad = { top: 12, right: 12, bottom: 30, left: 44 };
  const innerW = Math.max(60, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const maxCount = Math.max(...histogram.map(b => b.count), 1);
  const barWidth = innerW / histogram.length;

  return (
    <div className="chart" ref={ref}>
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--series-1)' }} />
          Trajectoires en profit
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: 'var(--critical)' }} />
          Trajectoires en perte
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`} height={height} role="img"
        aria-label="Distribution des capitaux finaux simulés"
      >
        <line className="axis-line" x1={pad.left} x2={pad.left + innerW}
              y1={pad.top + innerH} y2={pad.top + innerH} />
        {histogram.map((bin, i) => {
          const h = (bin.count / maxCount) * innerH;
          const above = bin.lower >= bankroll;
          return (
            <rect
              key={i}
              x={pad.left + i * barWidth + 1}
              y={pad.top + innerH - h}
              width={Math.max(1, barWidth - 2)}
              height={h}
              rx="2"
              fill={above ? 'var(--series-1)' : 'var(--critical)'}
              onMouseEnter={() => setHover({ ...bin, cx: pad.left + i * barWidth + barWidth / 2, cy: pad.top + innerH - h })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        <text x={pad.left} y={height - 8}>{money(histogram[0].lower, 0)}</text>
        <text x={pad.left + innerW} y={height - 8} textAnchor="end">
          {money(histogram[histogram.length - 1].upper, 0)}
        </text>
        <text x={pad.left - 8} y={pad.top + 10} textAnchor="end">{maxCount}</text>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.cx, top: hover.cy }}>
          <div>{money(hover.lower, 0)} – {money(hover.upper, 0)}</div>
          <div><strong>{hover.count}</strong> trajectoires</div>
        </div>
      )}
      <div className="card-note">
        Capital de départ : {money(bankroll)}. Chaque barre regroupe les
        trajectoires terminant dans cette tranche.
      </div>
    </div>
  );
}
