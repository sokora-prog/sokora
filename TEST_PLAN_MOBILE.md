# SOKORA Mobile — Plan de Tests (OPPO / Android)

**Appareil cible** : OPPO (Android 11+)
**App** : `sokora-mobile-v3` (Expo React Native)
**Date** : Avril 2026
**Environnement** : Production `https://api.sokora.app/api` + mode hors-ligne

---

## 1. ONBOARDING WIZARD

### TC-ON-01 — Premier lancement
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Installer l'APK, lancer l'app | Écran de bienvenue SOKORA affiché |
| 2 | Vérifier le logo et les couleurs | Navy `#0f1e35`, orange `#FF6B35` conformes |
| 3 | Taper « Commencer » | Slide vers étape 1 du wizard |

### TC-ON-02 — Saisie numéro de téléphone
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Entrer un numéro invalide (7 chiffres) | Message d'erreur inline, bouton désactivé |
| 2 | Entrer `+2250700000000` | Format CI accepté, indicatif auto-ajouté |
| 3 | Confirmer | Requête OTP envoyée, écran code SMS affiché |

### TC-ON-03 — Code OTP
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Attendre 60 s sans saisir | Compteur visible, bouton « Renvoyer » actif à 0 s |
| 2 | Saisir code incorrect (4 chiffres) | Message « Code incorrect » |
| 3 | Saisir code correct | Navigation vers étape profil |
| 4 | Vérifier `client_token` dans AsyncStorage | Token présent |

### TC-ON-04 — Création profil
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Laisser nom vide | Validation inline, impossible de continuer |
| 2 | Remplir nom + photo optionnelle | Photo uploadée, miniature affichée |
| 3 | Valider | Compte créé, navigation vers HomeScreen |

### TC-ON-05 — Re-lancement (déjà connecté)
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Fermer et rouvrir l'app | Wizard ignoré, HomeScreen direct |
| 2 | Vérifier token présent | Token valide en AsyncStorage |

---

## 2. POS CAISSE RAPIDE

### TC-POS-01 — Accès caisse
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Naviguer vers onglet « Caisse » | POS affiché avec grille produits |
| 2 | Vérifier que la liste charge | Produits établissement visibles < 2 s |

### TC-POS-02 — Panier
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Taper un produit | Quantité 1 ajoutée au panier |
| 2 | Re-taper le même produit | Quantité incrémentée à 2 |
| 3 | Appui long sur produit | Option modifier quantité ou supprimer |
| 4 | Supprimer un item | Ligne retirée, total recalculé |
| 5 | Vider le panier | Confirmation requise, panier vide |

### TC-POS-03 — Paiement
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Taper « Encaisser » | Modal paiement avec montant affiché |
| 2 | Choisir « Espèces » | Champ montant reçu visible, rendu de monnaie calculé |
| 3 | Choisir « Wallet SOKORA » | Champ numéro client, vérification solde |
| 4 | Choisir « Wave » | QR code ou numéro Wave généré |
| 5 | Choisir « Orange Money » | Instructions Orange Money affichées |
| 6 | Valider paiement | Reçu affiché, ticket imprimable |

### TC-POS-04 — Reçu
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Après paiement réussi | Reçu avec logo SOKORA, détail articles, total, méthode |
| 2 | Taper « Partager » | Options partage (WhatsApp, PDF, imprimer) |
| 3 | Taper « Nouvelle vente » | Panier réinitialisé, prêt pour prochain client |

### TC-POS-05 — Raccourci clavier numérique
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Utiliser le clavier rapide intégré | Saisie montant fluide sans clavier système |
| 2 | Taper « × » | Dernière saisie effacée |
| 3 | Taper « C » | Champ réinitialisé |

---

## 3. MODE HORS-LIGNE

### TC-OFF-01 — Activation hors-ligne
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Couper le Wi-Fi et les données mobiles sur l'OPPO | Bannière « Mode hors-ligne » affichée |
| 2 | Vérifier HomeScreen | Données précédentes affichées (cache) |

### TC-OFF-02 — POS hors-ligne
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Ouvrir la caisse sans réseau | Liste produits disponible (cache local) |
| 2 | Créer et valider une vente | Vente enregistrée localement avec indicateur sync en attente |
| 3 | Reconnecteur le réseau | Vente synchronisée automatiquement, indicateur disparu |
| 4 | Vérifier dans le dashboard web | Transaction apparaît avec timestamp hors-ligne |

### TC-OFF-03 — Données indisponibles
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Naviguer vers onglet nécessitant données fraiches | Message « Données hors-ligne — dernière MAJ : [date] » |
| 2 | Tenter une action requérant réseau (topup wallet) | Message explicite « Connexion requise » |

### TC-OFF-04 — Synchronisation en conflit
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Créer vente hors-ligne, puis même produit supprimé en ligne | Alerte conflit à la sync, choix utilisateur |

---

## 4. WALLET QR PAY

### TC-QR-01 — Générer QR client
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Ouvrir l'onglet Wallet | Solde affiché en XOF |
| 2 | Taper « Payer » ou « Mon QR » | QR code unique généré avec numéro client |
| 3 | Vérifier le contenu du QR | Encode `sokora:pay:{client_token}:{amount}` |
| 4 | Scanner avec un autre appareil | Prénom client + solde affichés côté caissier |

### TC-QR-02 — Scanner QR caissier (POS)
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Sur POS, choisir « Wallet SOKORA » comme paiement | Bouton « Scanner QR » visible |
| 2 | Scanner QR du client | Client identifié, solde vérifié |
| 3 | Confirmer montant exact | Débit instantané, confirmation des deux côtés |
| 4 | Solde insuffisant | Erreur explicite « Solde insuffisant : X XOF » |

### TC-QR-03 — Historique transactions
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Onglet Wallet → Historique | Dernières 20 transactions visibles |
| 2 | Filtrer par type | Entrées / sorties filtrées |
| 3 | Taper une transaction | Détail : établissement, date, montant, solde après |

### TC-QR-04 — Rechargement (Top-up)
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Taper « Recharger » | Options : Wave, Orange Money, MTN Money, Espèces |
| 2 | Wave : saisir montant | Lien de paiement Wave ou QR Wave généré |
| 3 | Après confirmation Wave | Solde mis à jour < 5 s |
| 4 | Recharge espèces | Demande en attente visible pour validation caissier |

---

## 5. PUSH NOTIFICATIONS

### TC-PUSH-01 — Permission
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Premier lancement | Dialog système permission notifications (Android) |
| 2 | Accepter | Token Expo Push enregistré dans le backend |
| 3 | Refuser | App fonctionnelle, pas de notifications, aucun crash |

### TC-PUSH-02 — Notification commande prête (KDS)
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Cuisiner une commande (KDS) et la passer « Prête » | Notification push reçue sur l'app serveur |
| 2 | App en arrière-plan | Notification dans le centre de notifications OPPO |
| 3 | Taper la notification | App s'ouvre sur l'écran commande correspondant |
| 4 | App fermée | Notification reçue, taper ouvre l'app et navigue |

### TC-PUSH-03 — Notification SOKORA Black (upgrade tier)
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Client atteint le seuil Silver (1000 pts) | Notification « Félicitations ! Vous êtes maintenant Silver 🥈 » |
| 2 | Taper la notification | Écran fidélité ouvert avec nouveau badge |

### TC-PUSH-04 — Notification wallet
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Recharge validée par caissier | Notification « +5 000 XOF crédités sur votre Wallet SOKORA » |
| 2 | Paiement reçu via QR | Notification montant débité côté client |

### TC-PUSH-05 — Gestion notifications
| Étape | Action | Résultat attendu |
|-------|--------|-----------------|
| 1 | Paramètres app → Notifications | Toggle par type : commandes, wallet, promo, fidélité |
| 2 | Désactiver un type | Plus de push pour ce type |
| 3 | OPPO « Économiseur de batterie » actif | Notifications toujours reçues (vérifier priorité Expo) |

---

## 6. TESTS DE PERFORMANCE OPPO

### TC-PERF-01 — Temps de chargement
| Métrique | Seuil acceptable |
|---------|-----------------|
| Lancement à froid (cold start) | < 3 secondes |
| Navigation entre onglets | < 500 ms |
| Chargement liste produits POS | < 2 secondes |
| Scan QR → identification client | < 1 seconde |

### TC-PERF-02 — Compatibilité OPPO
| Test | Action | Attendu |
|-----|--------|---------|
| ColorOS overlay | Vérifier que les modals s'affichent correctement | Pas de coupure par le notch / bord arrondi |
| Gestes navigation | Utiliser la navigation gestuelle OPPO | App réagit correctement, pas de conflit |
| Mode sombre OPPO | Activer le mode sombre système | App respecte ou ignore (thème propre) |
| Économiseur RAM OPPO | App tuée par ColorOS en fond | Reprise propre à la réouverture |

### TC-PERF-03 — Batterie et réseau
| Test | Action | Attendu |
|-----|--------|---------|
| 3G lente (simulée) | Throttle réseau à 500 kbps | Spinners visibles, pas de timeout silencieux |
| Coupure réseau pendant opération | Interrompre pendant un paiement | Rollback propre, message erreur, pas de double débit |
| 30 minutes d'utilisation POS | Utilisation intensive | Pas de fuite mémoire, température normale |

---

## 7. TESTS DE RÉGRESSION

| ID | Scénario | Priorité |
|----|---------|---------|
| TC-REG-01 | Login après expiration token (JWT 24h) | HAUTE |
| TC-REG-02 | Multi-établissement : changer d'établissement sans logout | HAUTE |
| TC-REG-03 | Panier POS survit à une mise en veille de 5 min | MOYENNE |
| TC-REG-04 | QR code expiré (> 5 min) refuse le paiement | HAUTE |
| TC-REG-05 | Double soumission paiement bloquée | CRITIQUE |
| TC-REG-06 | Rotation écran ne perd pas le panier | MOYENNE |
| TC-REG-07 | Accessibilité : taille texte système +200% | BASSE |
| TC-REG-08 | Localisation : français affiché par défaut | HAUTE |

---

## 8. CHECKLIST AVANT RELEASE

- [ ] Aucun `console.log` de données sensibles (token, PIN)
- [ ] Certificat SSL valide `api.sokora.app`
- [ ] Version APK signée avec keystore production
- [ ] Numéro de version incrémenté (`app.json` → `version`)
- [ ] Icône et splash screen conformes (512×512 orange sur navy)
- [ ] Permissions minimales déclarées dans `app.json`
- [ ] Tests sur OPPO A-series (1 Go RAM) + OPPO Find (4 Go RAM)
- [ ] Push notifications testées sur Expo Go ET standalone APK

---

*Généré pour SOKORA v3 — sokora-mobile-v3 — Côte d'Ivoire*
