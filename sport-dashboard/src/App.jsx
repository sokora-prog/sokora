import React, { useCallback, useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Matches from './components/Matches.jsx';
import LeagueTable from './components/LeagueTable.jsx';
import ValueBets from './components/ValueBets.jsx';
import BetTracker from './components/BetTracker.jsx';
import DataManager from './components/DataManager.jsx';
import Backtest from './components/Backtest.jsx';
import Realism from './components/Realism.jsx';
import Laboratory from './components/Laboratory.jsx';
import Connection from './components/Connection.jsx';
import { sportApi, errorMessage } from './services/api.js';
import { needsConfiguration } from './services/connection.js';

const TABS = [
  ['dashboard', "Vue d'ensemble"],
  ['matches', 'Matchs & analyse'],
  ['value', 'Valeur'],
  ['league', 'Championnats'],
  ['bets', 'Paris & bankroll'],
  ['realism', 'Réalisme'],
  ['lab', 'Laboratoire'],
  ['backtest', 'Backtest'],
  ['data', 'Données'],
  ['connexion', 'Connexion'],
];

const THEME_KEY = 'sokora_sport_theme';

export default function App() {
  // Tant qu'aucune adresse de backend n'est connue — le cas d'un APK
  // fraîchement installé — toute autre vue afficherait une erreur réseau sans
  // expliquer quoi faire. On ouvre donc directement sur « Connexion ».
  const [unconfigured, setUnconfigured] = useState(() => needsConfiguration());
  const [tab, setTab] = useState(() => (needsConfiguration() ? 'connexion' : 'dashboard'));
  const [competitions, setCompetitions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [matchId, setMatchId] = useState(null);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* stockage indisponible */ }
  }, [theme]);

  const loadReferences = useCallback(() => {
    if (needsConfiguration()) return; // rien à interroger : pas encore de serveur
    Promise.all([sportApi.competitions(), sportApi.teams()])
      .then(([c, t]) => { setCompetitions(c.data); setTeams(t.data); setError(null); })
      .catch(e => setError(errorMessage(e)));
  }, []);

  useEffect(loadReferences, [loadReferences]);

  const openMatch = id => { setMatchId(id); setTab('matches'); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>
            SOKORA Sport
            <small>Analyse des matchs & aide à la décision</small>
          </span>
        </div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {(unconfigured ? TABS.filter(([key]) => key === 'connexion') : TABS).map(([key, label]) => (
            <button
              key={key} className="tab" role="tab" type="button"
              aria-selected={tab === key} onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="topbar-spacer" />
        <div className="field" style={{ minWidth: 0 }}>
          <select
            value={theme} onChange={e => setTheme(e.target.value)}
            aria-label="Thème d'affichage"
          >
            <option value="system">Thème système</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </div>
      </header>

      <main className="main">
        {unconfigured && (
          <Connection
            onConnected={() => {
              setUnconfigured(false);
              setTab('dashboard');
              loadReferences();
            }}
          />
        )}

        {!unconfigured && error && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            API injoignable : {error}. Vérifiez que le backend tourne, puis
            contrôlez son adresse dans{' '}
            <button type="button" className="btn ghost" onClick={() => setTab('connexion')}>
              Connexion
            </button>.
          </div>
        )}

        {!unconfigured && tab === 'dashboard' && (
          <Dashboard
            onOpenMatch={openMatch}
            onSeeded={loadReferences}
            onOpenRealism={() => setTab('realism')}
          />
        )}
        {!unconfigured && tab === 'matches' && (
          <Matches
            competitions={competitions}
            selectedMatchId={matchId}
            onSelectMatch={setMatchId}
            onChanged={loadReferences}
          />
        )}
        {!unconfigured && tab === 'value' && <ValueBets competitions={competitions} onOpenMatch={openMatch} />}
        {!unconfigured && tab === 'league' && <LeagueTable competitions={competitions} />}
        {!unconfigured && tab === 'bets' && <BetTracker onChanged={loadReferences} />}
        {!unconfigured && tab === 'realism' && <Realism competitions={competitions} />}
        {!unconfigured && tab === 'lab' && <Laboratory competitions={competitions} />}
        {!unconfigured && tab === 'backtest' && <Backtest competitions={competitions} />}
        {!unconfigured && tab === 'data' && (
          <DataManager competitions={competitions} teams={teams} onChanged={loadReferences} />
        )}
        {!unconfigured && tab === 'connexion' && (
          <Connection onConnected={loadReferences} />
        )}
      </main>

      <footer className="main small muted" style={{ paddingTop: 0 }}>
        Outil personnel d'aide à la décision. Les probabilités sont des estimations
        issues de vos propres données : aucun modèle ne garantit un gain, et la
        gestion de bankroll compte davantage que la sélection.
      </footer>
    </div>
  );
}
