# SOKORA SPORT — Analyse des matchs et aide à la décision

Application personnelle destinée à un **parieur-analyste** : elle transforme un
historique de matchs en probabilités, compare ces probabilités aux cotes des
bookmakers, dimensionne la mise, puis mesure honnêtement les résultats.

La règle qui guide tout l'outil : **une décision correcte n'est pas une décision
gagnante, c'est une décision prise avec un avantage mesurable.** L'application
dit donc aussi, très souvent, de ne pas parier.

---

## 1. Ce que l'outil calcule

### Forces d'équipe et buts attendus

À partir des matchs joués, chaque équipe reçoit une **force d'attaque** et une
**force de défense** (1,00 = niveau moyen de la compétition), estimées par
ajustement itératif du modèle :

```
λ_domicile = μ · attaque_dom · défense_ext · H
λ_extérieur = μ · attaque_ext · défense_dom / H
```

- `μ` : buts moyens par équipe et par match dans la compétition ;
- `H` : avantage du terrain, déduit des données (`√(buts_dom / buts_ext)`) ;
- **pondération par la fraîcheur** : un match de six mois pèse moitié moins
  qu'un match d'aujourd'hui (demi-vie réglable) ;
- **rappel vers la moyenne** : une équipe à trois matchs reste proche de 1,00.
  Sans cela, un 7-0 isolé produirait des prévisions absurdes.

### Grille de scores et marchés

Les deux λ alimentent une grille de scores Poisson, **corrigée Dixon-Coles** —
le Poisson pur sous-estime les 0-0, 1-0, 0-1 et 1-1, qui sont précisément les
scores les plus fréquents au football.

De cette seule grille se déduisent, de façon cohérente entre elles, toutes les
probabilités : 1X2, double chance, plus/moins de buts (toutes lignes, avec
remboursement sur les lignes entières), les deux marquent, handicaps asiatiques
(y compris les lignes en quart de but), buts par équipe, pair/impair, clean
sheet, victoire sans encaisser, scores exacts.

### Valeur, cote équitable et mise

Pour chaque sélection cotée :

1. la marge du bookmaker est retirée du marché complet (méthode *odds ratio* par
   défaut, plus juste que la simple proportionnelle sur les favoris) ;
2. la probabilité retenue **mêle le modèle et le marché** (35 % de poids marché
   par défaut) — le marché agrège l'information de milliers d'acteurs, s'y
   adosser en partie réduit le risque de sur-confiance ;
3. l'**edge** est calculé : `p × cote − 1`, l'espérance de gain par euro misé ;
4. la mise suit un **quart de Kelly plafonné à 5 %** de la bankroll. Le Kelly
   plein maximise la croissance théorique mais produit des reculs
   insupportables en pratique.

### Garde-fous

- Un **indice de fiabilité** fondé sur la taille de l'échantillon : sous six
  matchs par équipe, l'outil déconseille explicitement de miser.
- Un **contrôle croisé par Elo**, modèle indépendant : un écart marqué avec le
  modèle de buts est un signal de prudence.
- Un **verdict** qui conclut `PARIER` ou `PASSER`, assorti de ses avertissements.

### Suivi de performance

ROI et yield, taux de réussite, cote moyenne, **repli maximal** (le vrai
indicateur de risque), pire série perdante, ventilation par marché, courbe de
bankroll, et **CLV** — l'écart entre la cote prise et la cote de clôture. Un CLV
positif durable est le seul signe fiable d'un avantage réel, bien avant que le
ROI ne devienne statistiquement significatif.

### Backtest

`GET /sport/backtest` rejoue la saison : pour chaque match, le modèle n'utilise
que les rencontres **antérieures au coup d'envoi**. Aucune fuite d'information,
donc un ROI comparable à ce qu'aurait donné la stratégie en conditions réelles —
à condition d'avoir saisi les cotes historiques.

---

## 2. Architecture

```
backend/app/analytics_sport.py   moteur statistique pur (aucune dépendance, aucun accès base)
backend/app/models_sport.py      tables : compétitions, équipes, matchs, cotes, paris, bankroll
backend/app/router_sport.py      API REST /sport
backend/migrations/sport_v1.sql  migration SQL idempotente
backend/tests/                   76 tests du moteur (unittest, sans dépendance)
sport-dashboard/                 interface React + Vite (port 5177)
```

Le moteur est volontairement séparé de la base : c'est ce qui rend la
statistique testable ligne à ligne, et réutilisable hors de l'API.

---

## 3. Démarrage

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Les tables sont créées au démarrage. Sur une base existante, appliquer plutôt :

```bash
psql "$DATABASE_URL" -f backend/migrations/sport_v1.sql
```

### Frontend

```bash
cd sport-dashboard
npm install
npm run dev        # http://localhost:5177
```

### Prise en main immédiate

```bash
curl -X POST "http://localhost:8000/sport/seed-demo?matches_per_team=26"
```

Crée un championnat fictif complet (10 équipes, matchs joués, matchs à venir
cotés, bankroll de départ) : de quoi parcourir toutes les vues sans saisie.

### Tests

```bash
cd backend && python3 -m unittest discover -s tests -v
```

---

## 4. Alimenter l'outil avec ses propres données

L'import CSV (onglet **Données**) accepte le séparateur `,` ou `;` et reconnaît
les en-têtes usuels :

| Champ | Colonnes acceptées |
|---|---|
| Équipes | `home` / `away`, ou `HomeTeam` / `AwayTeam` |
| Score | `home_goals` / `away_goals`, ou `FTHG` / `FTAG` |
| Date | `date`, `kickoff` (formats `2026-08-12`, `12/08/2026`, ISO…) |
| Bonus | `home_xg`, `away_xg`, `HS`/`AS`, `HST`/`AST`, `HC`/`AC`, `matchday` |

Les équipes inconnues sont créées automatiquement et un même match ne peut pas
être importé deux fois. Le format de football-data.co.uk passe tel quel.

**Ordre de grandeur utile** : le modèle devient exploitable vers 6-10 matchs par
équipe, et fiable au-delà de 20. En dessous, l'application le signale.

---

## 5. Principaux points d'API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/sport/dashboard` | vue d'ensemble (capital, performance, opportunités) |
| GET | `/sport/matches/{id}/analysis` | **analyse complète d'un match** |
| POST | `/sport/predict` | analyse à la demande de deux équipes + cotes |
| GET | `/sport/value-bets` | balayage des matchs à venir, classés par edge |
| GET | `/sport/backtest` | simulation historique sans fuite d'information |
| GET | `/sport/competitions/{id}/table` | classement enrichi + forces d'équipe |
| GET | `/sport/teams/{id}/stats` | fiche d'équipe (forme, domicile/extérieur, Elo) |
| POST | `/sport/matches/import` | import CSV en masse |
| POST | `/sport/matches/{id}/odds` | saisie des cotes |
| POST | `/sport/bets` · PUT `/sport/bets/{id}/settle` | suivi des paris |
| PUT | `/sport/matches/{id}/result` | score final + **règlement automatique des paris** |
| GET | `/sport/performance` | ROI, drawdown, CLV, bilan par marché |

Paramètres réglables sur l'analyse : `min_edge`, `kelly_fraction`,
`market_weight`, `half_life_days`, `form_window`, `bankroll`.

---

## 6. Limites à connaître

- **Le modèle ignore ce qu'il ne voit pas** : blessures, suspensions, enjeu,
  météo, calendrier européen. Les champs `home_boost` / `away_boost` (1,00 =
  neutre) permettent de les intégrer à la main, et `context_note` de garder
  trace du raisonnement.
- **Poisson suppose l'indépendance des buts** ; la correction Dixon-Coles ne
  répare que les petits scores. Les matchs à scénario particulier (carton rouge
  précoce, équipe déjà qualifiée) restent mal modélisés.
- **Les marchés liquides sont efficients.** Sur un 1X2 de grand championnat,
  trouver 5 % d'edge réel est rare ; un edge affiché de 15 % traduit
  généralement une erreur de saisie ou un échantillon trop court, pas une
  aubaine.
- **Le backtest surestime** dès que les cotes historiques manquent ou ont été
  relevées après coup.
- Un ROI positif sur moins d'une centaine de paris ne prouve rien : c'est le
  domaine de la chance, pas de la compétence. Le CLV répond plus vite.

Enfin : cet outil calcule des probabilités, il ne garantit aucun gain. La
gestion de bankroll — mise fractionnée, plafond, respect du seuil de valeur —
pèse plus lourd, sur la durée, que la qualité de la sélection.
