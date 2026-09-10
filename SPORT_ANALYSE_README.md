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

## 2. L'hypothèse de départ : le marché a raison

La plupart des outils de paris supposent l'inverse — que leur modèle voit ce que
le marché ne voit pas — et se contentent d'afficher un « edge » sans jamais le
vérifier. Cette application fait le pari opposé :

> **Par défaut, la cote de clôture est la meilleure estimation disponible.
> C'est au modèle de prouver, chiffres en main, qu'il apporte une information
> qu'elle ne contient pas. Tant que la preuve n'est pas faite, l'outil conseille
> de ne pas parier.**

Cette hypothèse est appliquée en trois endroits concrets.

### a) La décote des edges (« malédiction du vainqueur »)

Sur un match, l'outil évalue une trentaine de sélections. Chacune porte une
erreur d'estimation, et **le maximum d'un ensemble d'estimations bruitées est
systématiquement trop optimiste** : la sélection qui ressort en tête est
souvent celle dont l'erreur joue le plus en votre faveur.

Tout edge estimé subit donc une décote de 2 points avant d'être déclaré
exploitable, et la mise de Kelly est calculée sur la probabilité *après* décote.
Sur le jeu de démonstration, cette seule correction fait passer de 6 « paris de
valeur » à 0. Le paramètre `edge_haircut` permet de la régler, y compris à zéro
pour comparer.

### b) La calibration face au marché — `GET /sport/calibration`

L'outil rejoue l'historique, prévision par prévision, en n'utilisant chaque fois
que les matchs antérieurs au coup d'envoi, et compare :

| Mesure | Ce qu'elle dit |
|---|---|
| **Score de Brier** du modèle *contre* celui de la cote de clôture sans marge | qui prévoit le mieux, sur une règle de score propre |
| **Log-loss** | même question, en pénalisant durement les certitudes erronées |
| **Skill score** | l'écart relatif : positif = le modèle apporte quelque chose |
| **Courbe de fiabilité** | quand le modèle annonce 30 %, cela arrive-t-il 30 % du temps ? |
| **Poids marché optimal** | le mélange modèle/marché qui aurait minimisé la log-loss — **mesuré, pas choisi** |

Trois verdicts possibles : `AUCUNE DONNÉE`, `ÉCHANTILLON INSUFFISANT`
(moins de 100 prévisions — aucune conclusion n'est permise), `PAS MIEUX QUE LE
MARCHÉ`, ou `MODÈLE INFORMATIF`. Dans les trois premiers cas, le poids marché
recommandé est **1,00** : suivre le marché et s'abstenir.

### c) La significativité et le risque

- **Combien de paris faut-il pour trancher ?** Détecter un avantage réel de 2 %
  à cote 2,00 demande **environ 20 000 paris** à 95 % de confiance ; à cote 3,30,
  plus de 45 000. Un ROI positif sur une saison ne prouve donc à peu près rien —
  d'où l'insistance de l'outil sur le **CLV**, qui conclut en quelques dizaines
  de paris.
- **Test de significativité** sur le yield et sur le CLV, avec intervalle de
  confiance : l'outil dit explicitement quand un résultat est indistinguable du
  hasard.
- **Simulation de Monte-Carlo** — `GET /sport/risk-simulation` — qui sépare deux
  choses que tout le monde confond :

  | Paramètre | Rôle |
  |---|---|
  | `believed_edge` | l'avantage que l'on **croit** détenir → il dimensionne la mise |
  | `true_edge` | l'avantage **réellement** détenu → il détermine les résultats |

  Le scénario par défaut de l'onglet Réalisme fait diverger les deux : croire
  4 % quand on a −2 %. Sur 2 000 trajectoires de 500 paris, la médiane termine à
  −12 %, 72 % des trajectoires perdent et 77 % subissent un recul de plus de
  20 % — sans que rien, dans le comportement de mise, n'ait paru anormal.

  L'autre enseignement va dans l'autre sens : **même avec un avantage réel de
  2 %, 36 % des trajectoires finissent en perte sur 500 paris**. Un résultat
  négatif ne prouve pas que la méthode est mauvaise, ni un résultat positif
  qu'elle est bonne.

### Une mise en garde sur le jeu de démonstration

Le championnat de démonstration est engendré par le processus de Poisson que le
modèle suppose : le modèle y est **bien spécifié**, ce qui n'arrive jamais dans
la réalité. Ses résultats de calibration y sont donc flatteurs, et l'application
l'affiche explicitement dès qu'une mesure porte sur ces données. Sur de vraies
données, la cote de clôture intègre les compositions, les absences et l'argent
des professionnels : elle est bien plus difficile à battre. On le voit d'ailleurs
dans la démo elle-même — le modèle devance le marché sur le 1X2, mais perd
nettement sur le total de buts.

---

## 3. Architecture

```
backend/app/analytics_sport.py   moteur statistique pur (aucune dépendance, aucun accès base)
backend/app/calibration_sport.py calibration face au marché, significativité, Monte-Carlo
backend/app/models_sport.py      tables : compétitions, équipes, matchs, cotes, paris, bankroll
backend/app/router_sport.py      API REST /sport
backend/migrations/sport_v1.sql  migration SQL idempotente
backend/scripts/                 téléchargement de saisons réelles (football-data.co.uk)
backend/tests/                   139 tests (moteurs sans dépendance + régression sur l'import)
sport-dashboard/                 interface React + Vite (port 5177)
```

Le moteur est volontairement séparé de la base : c'est ce qui rend la
statistique testable ligne à ligne, et réutilisable hors de l'API.

---

## 4. Démarrage

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

Les tests des deux moteurs ne dépendent de rien d'autre que la bibliothèque
standard. La régression sur l'import du format football-data.co.uk a besoin de
FastAPI et SQLAlchemy — déjà requis par le backend — et se désactive d'elle-même
s'ils manquent.

---

## 5. Alimenter l'outil avec de vraies données

### La voie rapide : une saison réelle en une commande

[football-data.co.uk](https://www.football-data.co.uk/) publie gratuitement,
pour les principaux championnats européens, les scores, les statistiques de
match **et les cotes de clôture de plusieurs bookmakers**. Ce dernier point est
décisif : sans cotes de clôture, la calibration n'a aucune barre à franchir et
l'onglet Réalisme ne peut rien conclure.

```bash
# L'API doit tourner sur http://localhost:8000
python3 backend/scripts/fetch_football_data.py E0 2223 2324 2425
```

Trois saisons de Premier League, soit ~1 140 matchs et plusieurs dizaines de
milliers de cotes, dont celles de clôture. Puis :

```bash
curl -s 'http://localhost:8000/sport/calibration?market=1X2' | python3 -m json.tool
```

…ou l'onglet **Réalisme**, qui répond à la seule question qui compte :
*votre modèle bat-il la cote de clôture sur vos championnats ?*

Autres usages du script :

```bash
# Plusieurs championnats d'un coup
python3 backend/scripts/fetch_football_data.py --leagues E0,F1,SP1,D1,I1 2425

# Télécharger sans importer, pour inspecter les fichiers
python3 backend/scripts/fetch_football_data.py E0 2425 --out ./data --no-import

# N'importer que les cotes de clôture de Pinnacle
python3 backend/scripts/fetch_football_data.py E0 2425 \
    --closing-only --bookmakers Pinnacle
```

Codes utiles : `E0` Premier League · `E1` Championship · `F1` Ligue 1 ·
`D1` Bundesliga · `SP1` Liga · `I1` Serie A · `N1` Eredivisie · `P1` Portugal ·
`B1` Belgique · `T1` Turquie. Le code de saison joint les deux millésimes :
`2425` = 2024/2025.

### Les cotes importées

| Colonnes du fichier | Ce qui est enregistré |
|---|---|
| `PSCH` / `PSCD` / `PSCA` | 1X2, **clôture Pinnacle** — la ligne de référence |
| `AvgCH` / `MaxCH`… | 1X2 clôture, moyenne du marché et meilleure cote |
| `PSH` / `B365H` / `AvgH`… | 1X2 à l'ouverture, pour mesurer le mouvement de ligne |
| `PC>2.5` / `AvgC>2.5`… | plus/moins de 2,5 buts, ouverture et clôture |
| `AHCh` + `PCAHH` / `PCAHA` | handicap asiatique, ligne comprise (quarts de but inclus) |
| `BbAvH`, `BbAv>2.5`… | anciennes saisons (préfixe Betbrain, jusqu'à 2018/2019) |

Par défaut, trois bookmakers sont retenus — **Pinnacle** (la référence sharp),
**Moyenne** du marché et **Meilleure** cote — plutôt que la vingtaine de
colonnes disponibles, qui n'ajouteraient que du volume.

L'application applique alors la pratique réelle d'un parieur : **l'avis du
marché se lit sur la ligne de Pinnacle**, la plus serrée, tandis que **la mise
se joue à la meilleure cote trouvée**. La marge affichée est celle du book de
référence, jamais un panachage.

### Import manuel

L'onglet **Données** accepte n'importe quel CSV, séparateur `,` ou `;` :

| Champ | Colonnes acceptées |
|---|---|
| Équipes | `home` / `away`, ou `HomeTeam` / `AwayTeam` |
| Score | `home_goals` / `away_goals`, ou `FTHG` / `FTAG` |
| Date | `date`, `kickoff` (formats `2026-08-12`, `12/08/2026`, ISO…) |
| Bonus | `home_xg`, `away_xg`, `HS`/`AS`, `HST`/`AST`, `HC`/`AC`, `matchday` |

Les équipes inconnues sont créées automatiquement et un même match ne peut pas
être importé deux fois — le script de téléchargement est donc rejouable sans
risque de doublon.

**Ordre de grandeur utile** : le modèle devient exploitable vers 6-10 matchs par
équipe, et fiable au-delà de 20. Pour *juger* le modèle, il faut davantage :
la calibration ne conclut qu'à partir de 100 prévisions cotées, soit environ une
demi-saison de championnat.

---

## 6. Principaux points d'API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/sport/dashboard` | vue d'ensemble (capital, performance, opportunités) |
| GET | `/sport/matches/{id}/analysis` | **analyse complète d'un match** |
| POST | `/sport/predict` | analyse à la demande de deux équipes + cotes |
| GET | `/sport/value-bets` | balayage des matchs à venir, classés par edge |
| GET | `/sport/backtest` | simulation historique sans fuite d'information |
| GET | `/sport/calibration` | **le modèle bat-il la cote de clôture ?** |
| GET | `/sport/risk-simulation` | Monte-Carlo : avantage cru contre avantage réel |
| GET | `/sport/competitions/{id}/table` | classement enrichi + forces d'équipe |
| GET | `/sport/teams/{id}/stats` | fiche d'équipe (forme, domicile/extérieur, Elo) |
| POST | `/sport/matches/import` | import CSV en masse, **cotes comprises** |
| POST | `/sport/matches/{id}/odds` | saisie des cotes |
| POST | `/sport/bets` · PUT `/sport/bets/{id}/settle` | suivi des paris |
| PUT | `/sport/matches/{id}/result` | score final + **règlement automatique des paris** |
| GET | `/sport/performance` | ROI, drawdown, CLV, bilan par marché |

Paramètres réglables sur l'analyse : `min_edge`, `kelly_fraction`,
`market_weight`, `edge_haircut`, `half_life_days`, `form_window`, `bankroll`.

---

## 7. Limites à connaître

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
  aubaine. L'onglet Réalisme existe précisément pour vous en convaincre avec
  vos propres données plutôt qu'avec un argument d'autorité.
- **La calibration ne se transpose pas d'un marché à l'autre.** Un modèle qui
  bat la cote sur le 1X2 peut être franchement mauvais sur le total de buts.
  Mesurez chaque marché séparément avant de le jouer.
- **Le backtest surestime** dès que les cotes historiques manquent ou ont été
  relevées après coup.
- Un ROI positif sur moins d'une centaine de paris ne prouve rien : c'est le
  domaine de la chance, pas de la compétence. Le CLV répond plus vite.

Enfin : cet outil calcule des probabilités, il ne garantit aucun gain. La
gestion de bankroll — mise fractionnée, plafond, respect du seuil de valeur —
pèse plus lourd, sur la durée, que la qualité de la sélection.
