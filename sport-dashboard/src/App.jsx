import React, { useCallback, useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Matches from './components/Matches.jsx';
import LeagueTable from './components/LeagueTable.jsx';
import ValueBets from './components/ValueBets.jsx';
import BetTracker from './components/BetTracker.jsx';
import DataManager from './components/DataManager.jsx';
import Backtest from './components/Backtest.jsx';
import Realism from './components/Realism.jsx';
import { sportApi, errorMessage } from './services/api.js';

const TABS = [
  ['dashboard', "Vue d'ensemble"],
  ['matches', 'Matchs & analyse'],
  ['value', 'Valeur'],
  ['league', 'Championnats'],
  ['bets', 'Paris & bankroll'],
  ['realism', 'Réalisme'],
  ['backtest', 'Backtest'],
  ['data', 'Données'],
];

const THEME_KEY = 'sokora_sport_theme';

export default function App() {
  const [tab, setTab] = useState('dashboard');
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
          {TABS.map(([key, label]) => (
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
        {error && (
          <div className="notice error" style={{ marginBottom: 16 }}>
            API injoignable : {error}. Vérifiez que le backend tourne et que{' '}
            <span className="mono">VITE_API_URL</span> pointe dessus.
          </div>
        )}

        {tab === 'dashboard' && (
          <Dashboard
            onOpenMatch={openMatch}
            onSeeded={loadReferences}
            onOpenRealism={() => setTab('realism')}
          />
        )}
        {tab === 'matches' && (
          <Matches
            competitions={competitions}
            selectedMatchId={matchId}
            onSelectMatch={setMatchId}
            onChanged={loadReferences}
          />
        )}
        {tab === 'value' && <ValueBets competitions={competitions} onOpenMatch={openMatch} />}
        {tab === 'league' && <LeagueTable competitions={competitions} />}
        {tab === 'bets' && <BetTracker onChanged={loadReferences} />}
        {tab === 'realism' && <Realism competitions={competitions} />}
        {tab === 'backtest' && <Backtest competitions={competitions} />}
        {tab === 'data' && (
          <DataManager competitions={competitions} teams={teams} onChanged={loadReferences} />
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
