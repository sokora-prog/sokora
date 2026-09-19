/**
 * SOKORA Sport — service worker.
 *
 * Rôle : rendre l'application installable et instantanée au lancement, sans
 * jamais servir de données périmées.
 *
 * Règle centrale : **les appels à l'API ne sont jamais mis en cache.** Un
 * tableau de bord de paris qui afficherait une bankroll, une cote ou une
 * probabilité vieilles d'une semaine serait pire qu'inutile — il conduirait à
 * miser sur des chiffres faux. Hors ligne, l'application s'ouvre et le dit,
 * plutôt que de mentir.
 *
 * Seule la coquille (HTML, JS, CSS, icônes) est mise en cache.
 */

const VERSION = 'sokora-sport-v1';
const SHELL_CACHE = `${VERSION}-shell`;

// Extensions considérées comme des ressources statiques versionnées par Vite
// (leur nom contient un hachage : un nouveau build produit un nouveau nom).
const STATIC_PATTERN = /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/i;

self.addEventListener('install', event => {
  // La nouvelle version prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(['./', './index.html']))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => !key.startsWith(VERSION)).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // API : toujours le réseau, jamais le cache. Voir l'en-tête de ce fichier.
  //
  // La détection porte sur le préfixe /api/ et sur l'origine, jamais sur une
  // sous-chaîne comme « /sport/ » : l'application est elle-même servie sous ce
  // chemin, et un tel test désactiverait silencieusement tout le cache.
  const isApi = !sameOrigin || url.pathname.startsWith('/api/') || url.pathname.includes('/api/sport/');
  if (isApi) return;

  // Navigation : réseau d'abord pour récupérer la dernière version publiée,
  // coquille en cache si le réseau est absent.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Ressources statiques hachées : cache d'abord, c'est ce qui rend le
  // lancement instantané. Un nouveau build change leur nom, donc aucun risque
  // de servir un ancien script.
  if (sameOrigin && STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
