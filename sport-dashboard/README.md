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

## Choix de visualisation

- Palette catégorielle validée pour le daltonisme (séparation ΔE contrôlée en
  clair comme en sombre) ; le bleu porte toujours le modèle, l'orange le marché.
- Rampe séquentielle à une seule teinte pour la carte de chaleur des scores.
- Barres divergentes bleu/rouge autour d'un axe neutre pour le résultat par
  marché, où la polarité *est* la donnée.
- Chaque graphique est doublé d'une vue tableau repliable : l'information ne
  dépend jamais de la seule couleur.
- Thème clair, sombre ou système, mémorisé dans le navigateur.
