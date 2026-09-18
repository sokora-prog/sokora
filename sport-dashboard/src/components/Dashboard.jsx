import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { BankrollCurve, DivergingBars, StatTile } from './charts.jsx';
import {
  confidenceTone, dateTime, marketLabel, marketName, money, nf, pct, signed, statusLabel,
  statusTone,
} from '../lib/format.js';

export default function Dashboard({ onOpenMatch, onSeeded, onOpenRealism }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    sportApi.dashboard()
      .then(r => { setData(r.data); setError(null); })
      .catch(e => setError(errorMessage(e)));
  };

  useEffect(load, []);

  const seed = async () => {
    setBusy(true);
    try {
      await sportApi.seedDemo({ reset: true });
      load();
      onSeeded?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="notice error">Impossible de charger le tableau de bord : {error}</div>;
  if (!data) return <div className="empty">Chargement…</div>;

  const { bankroll, performance, counts, realism } = data;
  const hasData = counts.matches > 0;
  const stance = realism?.summary?.stance;
  const followMarket = stance === 'SUIVRE LE MARCHÉ';

  return (
    <div className="stack">
      {!hasData && (
        <div className="notice">
          Aucune donnée pour l'instant. Saisissez vos matchs dans l'onglet «&nbsp;Données&nbsp;»
          (import CSV possible), ou générez un championnat fictif pour explorer l'outil.
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={seed} disabled={busy}>
              {busy ? 'Génération…' : 'Générer un jeu de démonstration'}
            </button>
          </div>
        </div>
      )}

      {realism && hasData && (
        <div className={`notice${followMarket ? '' : ' ok'}`}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <strong>{realism.summary.headline}</strong> — {realism.calibration.message}
            </div>
            <div className="btn-row">
              <span className={`badge ${followMarket ? 'critical' : 'good'}`}>{stance}</span>
              <button className="ghost" onClick={() => onOpenRealism?.()}>
                Voir le détail
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-4">
        <StatTile
          label="Bankroll"
          value={money(bankroll.balance)}
          delta={performance.profit}
          deltaLabel={`${signed(performance.profit)} € réalisés`}
          sub={`${money(bankroll.exposure)} engagés · ${money(bankroll.available)} disponibles`}
        />
        <StatTile
          label="Yield (profit / misé)"
          value={`${nf(performance.yield_pct, 2)} %`}
          delta={performance.yield_pct}
          deltaLabel={`${performance.bets_settled} paris réglés`}
          sub={`${money(performance.staked)} misés au total`}
        />
        <StatTile
          label="Repli maximal"
          value={money(performance.max_drawdown)}
          sub={`${nf(performance.max_drawdown_pct, 1)} % du sommet · ${performance.worst_losing_streak} pertes d'affilée`}
        />
        <StatTile
          label="Valeur sur la clôture (CLV)"
          value={performance.clv_avg_pct === null ? '—' : `${nf(performance.clv_avg_pct, 2)} %`}
          sub={
            performance.clv_beat_rate === null
              ? 'Renseignez les cotes de clôture pour la mesurer'
              : `${pct(performance.clv_beat_rate)} des paris pris au-dessus de la clôture`
          }
        />
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Évolution de la bankroll</h2>
            <span className="hint">
              {performance.bets_settled} paris réglés · taux de réussite {pct(performance.win_rate)}
            </span>
          </div>
          <BankrollCurve points={data.bankroll_curve} />
          <div className="card-note">
            La ligne horizontale marque le capital de départ ({money(bankroll.starting_capital)}) :
            au-dessus, la stratégie est en profit.
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Résultat par marché</h2>
            <span className="hint">paris réglés</span>
          </div>
          <DivergingBars
            rows={(data.by_market || []).map(row => ({
              label: marketName(row.market),
              value: row.profit,
              sub: `ROI ${pct(row.roi)} · ${row.bets} paris`,
            }))}
          />
          <div className="card-note">
            Un marché durablement négatif signale une faiblesse du modèle sur ce
            type de pari : mieux vaut cesser de le jouer.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Meilleures opportunités détectées</h2>
          <span className="hint">
            edge = espérance de gain par euro misé, probabilité mêlant modèle et marché
          </span>
        </div>
        {data.top_value_bets?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Coup d'envoi</th>
                  <th>Sélection</th>
                  <th className="num">Cote</th>
                  <th className="num">Cote juste</th>
                  <th className="num">Edge</th>
                  <th className="num">Mise Kelly</th>
                  <th>Fiabilité</th>
                </tr>
              </thead>
              <tbody>
                {data.top_value_bets.map((bet, i) => (
                  <tr
                    key={i}
                    className="clickable"
                    onClick={() => onOpenMatch?.(bet.match_id)}
                    title="Ouvrir l'analyse complète du match"
                  >
                    <td>{bet.match}</td>
                    <td>{dateTime(bet.kickoff)}</td>
                    <td>{marketLabel(bet.market, bet.selection)}</td>
                    <td className="num">{nf(bet.odds)}</td>
                    <td className="num">{nf(bet.fair_odds)}</td>
                    <td className="num" style={{ color: 'var(--good-text)', fontWeight: 600 }}>
                      +{nf(bet.edge_pct, 2)} %
                    </td>
                    <td className="num">{money(bet.kelly.stake)}</td>
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
            {data.top_value_scanned === 0
              ? <>Aucun match à venir avec des cotes. Enregistrez des cotes sur
                  vos matchs à venir pour que la comparaison soit possible.</>
              : data.top_value_note
                || <>Aucune opportunité au-dessus du seuil.</>}
          </div>
        )}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Prochains matchs</h2>
            <span className="hint">{counts.scheduled} programmés</span>
          </div>
          {data.upcoming_matches?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Affiche</th><th>Coup d'envoi</th>
                    <th className="num">Cotes</th><th className="num">Paris</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_matches.map(match => (
                    <tr key={match.id} className="clickable" onClick={() => onOpenMatch?.(match.id)}>
                      <td>{match.home_team} — {match.away_team}</td>
                      <td>{dateTime(match.kickoff)}</td>
                      <td className="num">{match.odds_count}</td>
                      <td className="num">{match.bets_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Aucun match programmé.</div>}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Derniers paris</h2>
            <span className="hint">
              {performance.bets_pending} en cours · {money(performance.pending_stake)} engagés
            </span>
          </div>
          {data.recent_bets?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sélection</th><th className="num">Cote</th>
                    <th className="num">Mise</th><th>État</th><th className="num">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_bets.map(bet => (
                    <tr key={bet.id}>
                      <td>{marketLabel(bet.market, bet.selection)}</td>
                      <td className="num">{nf(bet.odds)}</td>
                      <td className="num">{money(bet.stake)}</td>
                      <td>
                        <span className={`badge ${statusTone[bet.status] || ''}`}>
                          {statusLabel[bet.status] || bet.status}
                        </span>
                      </td>
                      <td className="num">{bet.status === 'PENDING' ? '—' : `${signed(bet.profit)} €`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">Aucun pari enregistré.</div>}
        </div>
      </div>

      <div className="card small muted">
        Base de données — compétitions : {counts.competitions} · équipes : {counts.teams} ·
        matchs joués : {counts.finished} · à venir : {counts.scheduled}.
      </div>
    </div>
  );
}
