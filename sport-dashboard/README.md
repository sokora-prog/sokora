# SOKORA Sport — analyse des matchs et aide à la décision

Interface React (Vite) du module d'analyse sportive. Elle consomme l'API
`/sport` du backend FastAPI.

## Démarrage

```bash
npm install
npm run dev          # http://localhost:5177
```

L'URL de l'API se règle par `VITE_API_URL` (défaut : `http://localhost:8000`) :

```bash
echo "VITE_API_URL=http://localhost:8000" > .env.local
```

## Sections

| Onglet | Contenu |
|---|---|
| Vue d'ensemble | bankroll, yield, repli maximal, CLV, courbe de capital, meilleures opportunités |
| Matchs & analyse | liste filtrable, saisie de score, **analyse complète d'une affiche** |
| Valeur | balayage de tous les matchs à venir cotés, classés par edge |
| Championnats | classement enrichi (PPG domicile/extérieur, over 2.5, BTTS) et fiche d'équipe |
| Paris & bankroll | suivi des paris, règlement, mouvements de capital, lecture des indicateurs |
| **Réalisme** | **le modèle bat-il la cote de clôture ? courbe de fiabilité, significativité, simulation de risque** |
| **Laboratoire** | **banc d'essai des variantes de modèle, carte des avantages par segment, journal de prévisions gelées** |
| Backtest | simulation de la stratégie sur l'historique, sans fuite d'information |
| Données | import CSV, création de compétitions / matchs, saisie des cotes |

## Sur le téléphone

L'application est installable (PWA) : servie en HTTPS, le navigateur propose de
l'ajouter à l'écran d'accueil, où elle s'ouvre en plein écran avec sa propre
icône.

- **Android (Chrome)** : menu ⋮ → *Installer l'application*.
- **iPhone (Safari)** : bouton *Partager* → *Sur l'écran d'accueil*.

Le service worker met en cache la coquille (HTML, JS, CSS, icônes) pour un
lancement instantané, mais **jamais les appels à l'API** : des cotes ou une
bankroll périmées conduiraient à miser sur des chiffres faux.

La marche à suivre complète — essai sur le réseau local, déploiement sur le VPS,
et la mise en garde sur l'absence d'authentification — est dans
`SPORT_ANALYSE_README.md`, section 6.

Icônes : `python3 scripts/generate_icons.py` (bibliothèque standard uniquement).

## Choix de visualisation

- Palette catégorielle validée pour le daltonisme (séparation ΔE contrôlée en
  clair comme en sombre) ; le bleu porte toujours le modèle, l'orange le marché.
- Rampe séquentielle à une seule teinte pour la carte de chaleur des scores.
- Barres divergentes bleu/rouge autour d'un axe neutre pour le résultat par
  marché, où la polarité *est* la donnée.
- Chaque graphique est doublé d'une vue tableau repliable : l'information ne
  dépend jamais de la seule couleur.
- Thème clair, sombre ou système, mémorisé dans le navigateur.
