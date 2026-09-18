import React, { useState } from 'react';
import {
  getApiBase, setApiBase, getApiToken, setApiToken,
  isNativeShell, testApiBase,
} from '../services/connection.js';

/**
 * Écran « Connexion » : dire à l'application où joindre le backend.
 *
 * Sert deux situations. Sur le web, on n'y vient presque jamais (l'API est sur
 * la même origine). Dans l'APK, c'est le tout premier écran : sans adresse,
 * l'application ne peut rien afficher, et il vaut mieux le dire franchement
 * que d'empiler des erreurs réseau.
 */
export default function Connection({ onConnected }) {
  const [base, setBase] = useState(() => getApiBase());
  const [token, setToken] = useState(() => getApiToken());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const native = isNativeShell();

  async function check(andSave) {
    setBusy(true);
    setResult(null);
    const outcome = await testApiBase(base, token);
    setResult(outcome);
    if (outcome.ok && andSave) {
      setApiBase(base);
      setApiToken(token);
      onConnected?.();
    }
    setBusy(false);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h1>Connexion au serveur</h1>
          <span className="hint">
            {native ? 'application installée' : 'application web'}
          </span>
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          {native ? (
            <>
              L'application est installée sur le téléphone, mais les données
              restent sur l'ordinateur. Indiquez son adresse sur le réseau
              local — par exemple <span className="mono">http://192.168.1.20:8001</span>.
              Les deux appareils doivent être sur le même Wi-Fi.
            </>
          ) : (
            <>
              Par défaut, l'application interroge l'adresse fixée à la
              compilation (<span className="mono">VITE_API_URL</span>). Vous
              pouvez la remplacer ici sans reconstruire.
            </>
          )}
        </p>

        <div className="toolbar" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 260px', minWidth: 0 }}>
            <label htmlFor="cx-base">Adresse du backend</label>
            <input
              id="cx-base" type="url" inputMode="url" autoComplete="off"
              placeholder="http://192.168.1.20:8001"
              value={base} onChange={e => setBase(e.target.value)}
            />
          </div>
          <div className="field" style={{ flex: '0 1 200px', minWidth: 0 }}>
            <label htmlFor="cx-token">Jeton (si configuré)</label>
            <input
              id="cx-token" type="password" autoComplete="off"
              placeholder="facultatif"
              value={token} onChange={e => setToken(e.target.value)}
            />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => check(false)}>
            {busy ? 'Test…' : 'Tester'}
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => check(true)}>
            Tester et enregistrer
          </button>
        </div>

        {result && (
          <div className={`notice ${result.ok ? "ok" : "error"}`} style={{ marginTop: 12 }}>
            {result.detail}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>Trouver l'adresse de l'ordinateur</h2></div>
        <ul className="muted" style={{ marginBottom: 0 }}>
          <li>
            Windows : <span className="mono">ipconfig</span> — relever
            « Adresse IPv4 » de la carte Wi-Fi.
          </li>
          <li>
            macOS / Linux : <span className="mono">hostname -I</span> ou{' '}
            <span className="mono">ip addr</span>.
          </li>
          <li>
            Le backend doit écouter sur le réseau et pas seulement sur
            lui-même : <span className="mono">--host 0.0.0.0</span>.
          </li>
          <li>
            Le pare-feu de l'ordinateur doit laisser entrer le port 8001.
          </li>
        </ul>
      </div>

      <div className="card">
        <div className="card-head"><h2>Qui peut lire ces données</h2></div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Le module n'a pas de compte utilisateur. Dès que le backend écoute sur
          le réseau local, toute personne connectée au même Wi-Fi peut lire la
          bankroll et modifier les paris. Sur un réseau domestique dont vous
          maîtrisez l'accès, c'est acceptable. Ailleurs — bureau, logement
          partagé, hébergement — définissez la variable{' '}
          <span className="mono">SPORT_API_TOKEN</span> côté serveur et reportez
          le même jeton ci-dessus : les requêtes sans jeton seront refusées.
        </p>
      </div>
    </div>
  );
}
