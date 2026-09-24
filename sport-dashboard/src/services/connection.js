/**
 * Où se trouve le backend — décidé à l'exécution, pas à la compilation.
 *
 * Sur le web, l'application et l'API partagent l'origine : `/api` suffit, et
 * c'est ce que `VITE_API_URL` contient. Dans un APK, il n'y a plus d'origine
 * commune : les fichiers de l'application sont servis depuis `https://localhost`
 * par le composant natif, tandis que le backend tourne sur l'ordinateur, à une
 * adresse que seul l'utilisateur connaît (`http://192.168.1.20:8000`) et qui
 * change avec le réseau. Une adresse figée au build serait donc fausse dès le
 * premier lancement.
 *
 * L'adresse est donc saisie dans l'application, vérifiée, puis mémorisée.
 */

const BASE_KEY = 'sokora_sport_api_base';
const TOKEN_KEY = 'sokora_sport_api_token';

/** Valeur compilée : chemin relatif servi par nginx, ou repli développement. */
const BUILD_TIME_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Vrai dans la coquille Android/iOS. Capacitor pose cet objet global ; on le lit
 * plutôt que d'importer le paquet, pour que le build web n'en dépende pas.
 */
export function isNativeShell() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function readStored(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return ''; // navigation privée, stockage refusé : on repart du défaut
  }
}

/**
 * Met une saisie humaine sous forme d'URL utilisable.
 * « 192.168.1.20:8000 » → « http://192.168.1.20:8000 ».
 */
export function normalizeBase(input) {
  const raw = (input || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

/** Adresse effective de l'API pour la requête en cours. */
export function getApiBase() {
  const stored = readStored(BASE_KEY);
  if (stored) return stored;
  // Dans l'APK, un chemin relatif ne désigne aucun serveur : mieux vaut ne rien
  // renvoyer et laisser l'écran de connexion s'afficher qu'échouer sans raison
  // lisible sur chaque appel.
  if (isNativeShell() && BUILD_TIME_BASE.startsWith('/')) return '';
  return BUILD_TIME_BASE;
}

export function setApiBase(value) {
  const normalized = normalizeBase(value);
  try {
    if (normalized) localStorage.setItem(BASE_KEY, normalized);
    else localStorage.removeItem(BASE_KEY);
  } catch { /* stockage indisponible : la valeur ne survivra pas à la session */ }
  return normalized;
}

/** Jeton partagé, facultatif (voir SPORT_API_TOKEN côté backend). */
export function getApiToken() {
  return readStored(TOKEN_KEY);
}

export function setApiToken(value) {
  const token = (value || '').trim();
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* idem */ }
  return token;
}

/** Vrai tant qu'aucune adresse utilisable n'est connue (cas de l'APK neuf). */
export function needsConfiguration() {
  return !getApiBase();
}

/**
 * Interroge une adresse candidate sans l'enregistrer.
 *
 * Renvoie `{ ok, detail }`. On vise `/sport/competitions`, peu coûteux et
 * présent dès la première installation, plutôt que le tableau de bord qui
 * recalcule tout le modèle.
 */
export async function testApiBase(candidate, token) {
  const base = normalizeBase(candidate);
  if (!base) return { ok: false, detail: 'Adresse vide.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const headers = {};
    const auth = (token ?? getApiToken()).trim();
    if (auth) headers['X-Sport-Token'] = auth;

    const response = await fetch(`${base}/sport/competitions`, {
      signal: controller.signal,
      headers,
    });
    if (response.ok) return { ok: true, detail: `Contacté (HTTP ${response.status}).` };
    if (response.status === 401) {
      return { ok: false, detail: 'Serveur joint, mais le jeton est absent ou faux.' };
    }
    return { ok: false, detail: `Serveur joint, réponse HTTP ${response.status}.` };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, detail: 'Aucune réponse en 6 s — mauvaise adresse, ou téléphone et ordinateur sur des réseaux différents.' };
    }
    return { ok: false, detail: `Contact impossible : ${error.message}` };
  } finally {
    clearTimeout(timer);
  }
}
