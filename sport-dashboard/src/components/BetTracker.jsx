import React, { useEffect, useState } from 'react';
import { sportApi, errorMessage } from '../services/api.js';
import { BankrollCurve, DivergingBars, StatTile } from './charts.jsx';
import {
  dateTime, marketLabel, marketName, money, nf, pct, signed, statusLabel, statusTone,
} from '../lib/format.js';

const SETTLE_OPTIONS = ['WON', 'LOST', 'VOID', 'HALF_WON', 'HALF_LOST', 'CASHOUT'];

export default function BetTracker({ onChanged }) {
  const [bets, setBets] = useState([]);
  const [perf, setPerf] = useState(null);
  const [bankroll, setBankroll] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [settleDraft, setSettleDraft] = useState(null);
  const [tx, setTx] = useState({ type: 'DEPOSIT', amount: '', note: '' });

  const load = () => {
    const params = statusFilter ? { status: statusFilter } : {};
    Promise.all([sportApi.bets(params), sportApi.performance(), sportApi.bankroll()])
      .then(([b, p, k]) => {
        setBets(b.data);
        setPerf(p.data.performance);
        setBankroll(k.data);
        setError(null);
      })
      .catch(e => setError(errorMessage(e)));
  };

  useEffect(load, [statusFilter]);

  const settle = async () => {
    try {
      const body = { status: settleDraft.status };
      if (settleDraft.closing_odds) body.closing_odds = Number(settleDraft.closing_odds);
      if (settleDraft.status === 'CASHOUT') body.profit = Number(settleDraft.profit || 0);
      await sportApi.settleBet(settleDraft.id, body);
      setSettleDraft(null);
      setFlash('Pari réglé.');
      load();
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const removeBet = async id => {
    await sportApi.deleteBet(id);
    load();
    onChanged?.();
  };

  const addTx = async event => {
    event.preventDefault();
    try {
      await sportApi.addBankrollTx({
        type: tx.type, amount: Number(tx.amount), note: tx.note || null,
      });
      setTx({ type: 'DEPOSIT', amount: '', note: '' });
      setFlash('Mouvement enregistré.');
      load();
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="stack">
      {error && <div className="notice error">{error}</div>}
      {flash && <div className="notice ok">{flash}</div>}

      {perf && bankroll && (
        <>
          <div className="grid grid-4">
            <StatTile
              label="Bankroll actuelle" value={money(bankroll.balance)}
              sub={`capital ${money(bankroll.starting_capital)} · ${money(bankroll.exposure)} engagés`}
            />
            <StatTile
              label="Profit réalisé" value={`${signed(perf.profit)} €`}
              delta={perf.profit} deltaLabel={`ROI ${pct(perf.roi)}`}
              sub={`${money(perf.staked)} misés sur ${perf.bets_settled} paris`}
            />
            <StatTile
              label="Cote moyenne jouée" value={nf(perf.avg_odds)}
              sub={`mise moyenne ${money(perf.avg_stake)} · réussite ${pct(perf.win_rate)}`}
            />
            <StatTile
              label="Edge moyen espéré"
              value={perf.avg_expected_edge === null ? '—' : pct(perf.avg_expected_edge)}
              sub={
                perf.avg_expected_edge === null
                  ? 'Renseignez la probabilité du modèle à la saisie'
                  : "à comparer au ROI réel : un écart durable signale un modèle trop optimiste"
              }
            />
          </div>

          <div className="split">
            <div className="card">
              <div className="card-head">
                <h2>Courbe de bankroll</h2>
                <span className="hint">
                  repli maximal {money(perf.max_drawdown)} ({nf(perf.max_drawdown_pct, 1)} %)
                </span>
              </div>
              <BankrollCurve points={perf.bankroll_curve} />
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Résultat par marché</h2>
                <span className="hint">où se gagne (et se perd) l'argent</span>
              </div>
              <DivergingBars
                rows={(perf.by_market || []).map(row => ({
                  label: marketName(row.market), value: row.profit,
                  sub: `ROI ${pct(row.roi)} · ${row.bets} paris`,
                }))}
              />
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Mes paris</h2>
          <div className="field">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Tous les états</option>
              <option value="PENDING">En cours</option>
              {SETTLE_OPTIONS.map(s => (
                <option key={s} value={s}>{statusLabel[s]}</option>
              ))}
            </select>
          </div>
        </div>
        {bets.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Match</th><th>Sélection</th><th>Bookmaker</th>
                  <th className="num">Cote</th><th className="num">Mise</th>
                  <th className="num">Edge estimé</th><th className="num">CLV</th>
                  <th>État</th><th className="num">Résultat</th><th />
                </tr>
              </thead>
              <tbody>
                {bets.map(bet => (
                  <tr key={bet.id}>
                    <td>{dateTime(bet.placed_at)}</td>
                    <td>{bet.match || bet.label || '—'}</td>
                    <td>{marketLabel(bet.market, bet.selection)}</td>
                    <td>{bet.bookmaker || '—'}</td>
                    <td className="num">{nf(bet.odds)}</td>
                    <td className="num">{money(bet.stake)}</td>
                    <td className="num">{bet.edge != null ? `${signed(bet.edge * 100, 2)} %` : '—'}</td>
                    <td className="num">{bet.clv_pct != null ? `${signed(bet.clv_pct, 2)} %` : '—'}</td>
                    <td>
                      <span className={`badge ${statusTone[bet.status] || ''}`}>
                        {statusLabel[bet.status] || bet.status}
                      </span>
                    </td>
                    <td
                      className="num"
                      style={{
                        color: bet.status === 'PENDING' ? 'var(--muted)'
                          : bet.profit > 0 ? 'var(--good-text)'
                            : bet.profit < 0 ? 'var(--critical)' : 'var(--ink-2)',
                      }}
                    >
                      {bet.status === 'PENDING'
                        ? `gain possible ${money(bet.potential_return - bet.stake)}`
                        : `${signed(bet.profit)} €`}
                    </td>
                    <td>
                      <div className="btn-row">
                        {bet.status === 'PENDING' && (
                          <button
                            className="ghost"
                            onClick={() => setSettleDraft({
                              id: bet.id, status: 'WON', closing_odds: '', profit: '',
                              label: marketLabel(bet.market, bet.selection),
                            })}
                          >
                            Régler
                          </button>
                        )}
                        <button className="ghost danger" onClick={() => removeBet(bet.id)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Aucun pari enregistré. Les paris se créent depuis l'analyse d'un match,
            bouton «&nbsp;Miser&nbsp;».
          </div>
        )}

        {settleDraft && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <div className="card-head"><h3>Régler — {settleDraft.label}</h3></div>
            <div className="row">
              <div className="field">
                <label htmlFor="st">Résultat</label>
                <select
                  id="st" value={settleDraft.status}
                  onChange={e => setSettleDraft({ ...settleDraft, status: e.target.value })}
                >
                  {SETTLE_OPTIONS.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="clo">Cote de clôture (facultatif)</label>
                <input
                  id="clo" type="number" step="0.01" min="1.01" value={settleDraft.closing_odds}
                  onChange={e => setSettleDraft({ ...settleDraft, closing_odds: e.target.value })}
                />
              </div>
              {settleDraft.status === 'CASHOUT' && (
                <div className="field">
                  <label htmlFor="pf">Profit net encaissé (€)</label>
                  <input
                    id="pf" type="number" step="0.01" value={settleDraft.profit}
                    onChange={e => setSettleDraft({ ...settleDraft, profit: e.target.value })}
                  />
                </div>
              )}
              <div className="btn-row">
                <button className="primary" onClick={settle}>Valider</button>
                <button className="ghost" onClick={() => setSettleDraft(null)}>Annuler</button>
              </div>
            </div>
            <div className="card-note">
              La cote de clôture permet de calculer le CLV, meilleur indicateur
              long terme : battre la clôture durablement prouve un avantage réel.
            </div>
          </div>
        )}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-head"><h2>Mouvements de capital</h2></div>
          <form className="row" onSubmit={addTx}>
            <div className="field">
              <label htmlFor="tx-type">Type</label>
              <select id="tx-type" value={tx.type} onChange={e => setTx({ ...tx, type: e.target.value })}>
                <option value="DEPOSIT">Dépôt</option>
                <option value="WITHDRAWAL">Retrait</option>
                <option value="ADJUSTMENT">Ajustement (bonus, frais)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-amount">Montant (€)</label>
              <input
                id="tx-amount" type="number" step="0.01" min="0.01" required
                value={tx.amount} onChange={e => setTx({ ...tx, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tx-note">Note</label>
              <input id="tx-note" value={tx.note} onChange={e => setTx({ ...tx, note: e.target.value })} />
            </div>
            <button className="primary" type="submit">Ajouter</button>
          </form>
          {bankroll?.transactions?.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr><th>Date</th><th>Type</th><th className="num">Montant</th><th>Note</th><th /></tr>
                </thead>
                <tbody>
                  {bankroll.transactions.map(row => (
                    <tr key={row.id}>
                      <td>{dateTime(row.created_at)}</td>
                      <td>{{ DEPOSIT: 'Dépôt', WITHDRAWAL: 'Retrait', ADJUSTMENT: 'Ajustement' }[row.type]}</td>
                      <td className="num">{money(row.amount)}</td>
                      <td>{row.note || '—'}</td>
                      <td>
                        <button
                          className="ghost danger"
                          onClick={async () => {
                            await sportApi.deleteBankrollTx(row.id);
                            load();
                            onChanged?.();
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {perf && (
          <div className="card">
            <div className="card-head"><h2>Lecture des indicateurs</h2></div>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr>
                    <td>Yield</td>
                    <td className="num"><strong>{nf(perf.yield_pct, 2)} %</strong></td>
                    <td className="muted small">
                      Profit rapporté au total misé. Au-delà de 5 % sur plusieurs
                      centaines de paris, l'avantage est probablement réel.
                    </td>
                  </tr>
                  <tr>
                    <td>Repli maximal</td>
                    <td className="num"><strong>{nf(perf.max_drawdown_pct, 1)} %</strong></td>
                    <td className="muted small">
                      Pire recul depuis un sommet. Il dicte la taille de mise
                      supportable psychologiquement.
                    </td>
                  </tr>
                  <tr>
                    <td>Série perdante la plus longue</td>
                    <td className="num"><strong>{perf.worst_losing_streak}</strong></td>
                    <td className="muted small">
                      Normal même avec un avantage : à cote 3,00, dix pertes
                      d'affilée arrivent régulièrement.
                    </td>
                  </tr>
                  <tr>
                    <td>CLV moyen</td>
                    <td className="num">
                      <strong>{perf.clv_avg_pct === null ? '—' : `${nf(perf.clv_avg_pct, 2)} %`}</strong>
                    </td>
                    <td className="muted small">
                      Écart entre la cote prise et la cote de clôture. Positif
                      durablement = avantage réel, indépendamment de la chance.
                    </td>
                  </tr>
                  <tr>
                    <td>Paris en cours</td>
                    <td className="num"><strong>{perf.bets_pending}</strong></td>
                    <td className="muted small">
                      {money(perf.pending_stake)} encore engagés, non comptés dans le ROI.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
