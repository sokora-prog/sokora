/**
 * SOKORA — Mode hors-ligne / Offline Queue
 *
 * Fonctionnement :
 *  - useNetworkStatus()     → { isOnline, isChecking }
 *  - enqueueAction(action)  → met en file une action (ex. créer commande)
 *  - flushQueue()           → rejoue toutes les actions en attente
 *  - useOfflineSync()       → hook qui flush automatiquement au retour en ligne
 *
 * Structure d'une action :
 *  { id, type, payload, createdAt, retries }
 *
 * Types supportés :
 *  'CREATE_ORDER'    → POST /orders/
 *  'UPDATE_STATUS'   → PATCH /orders/:id/status
 *  'ADD_ITEMS'       → POST /orders/:id/items
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { API_URL } from '../utils/constants';

const QUEUE_KEY   = 'sokora_offline_queue';
const MAX_RETRIES = 3;

// ─────────────────────────────────────────────────────────────────────────────
//  CONNECTIVITY CHECK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie la connectivité en tentant un HEAD sur l'API.
 * Plus fiable que navigator.onLine qui peut mentir.
 */
export async function checkConnectivity() {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${API_URL}/health`, {
      method: 'HEAD',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HOOK useNetworkStatus
// ─────────────────────────────────────────────────────────────────────────────

export function useNetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef(null);

  const check = useCallback(async () => {
    setIsChecking(true);
    const online = await checkConnectivity();
    setIsOnline(online);
    setIsChecking(false);
    return online;
  }, []);

  useEffect(() => {
    // Vérif initiale
    check();

    // Poll toutes les 15 secondes
    intervalRef.current = setInterval(check, 15000);

    // Re-check quand l'app revient au premier plan
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [check]);

  return { isOnline, isChecking, recheck: check };
}

// ─────────────────────────────────────────────────────────────────────────────
//  QUEUE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Ajouter une action à la file hors-ligne.
 * Retourne l'ID de l'action créée.
 */
export async function enqueueAction(type, payload) {
  const queue = await getQueue();
  const action = {
    id:        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries:   0,
  };
  queue.push(action);
  await saveQueue(queue);
  return action.id;
}

async function removeAction(id) {
  const queue = await getQueue();
  await saveQueue(queue.filter(a => a.id !== id));
}

async function incrementRetry(id) {
  const queue = await getQueue();
  await saveQueue(queue.map(a => a.id === id ? { ...a, retries: a.retries + 1 } : a));
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exécute une action en file.
 * Retourne true si succès, false si erreur temporaire.
 */
async function executeAction(action, token) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    let res;
    switch (action.type) {
      case 'CREATE_ORDER':
        res = await fetch(`${API_URL}/orders/`, {
          method:  'POST',
          headers,
          body:    JSON.stringify(action.payload),
        });
        break;

      case 'ADD_ITEMS':
        res = await fetch(`${API_URL}/orders/${action.payload.orderId}/items`, {
          method:  'POST',
          headers,
          body:    JSON.stringify(action.payload.items),
        });
        break;

      case 'UPDATE_STATUS':
        res = await fetch(`${API_URL}/orders/${action.payload.orderId}/status`, {
          method:  'PATCH',
          headers,
          body:    JSON.stringify({ status: action.payload.status }),
        });
        break;

      default:
        // Type inconnu — supprimer pour ne pas bloquer la file
        return true;
    }

    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FLUSH QUEUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rejoue toutes les actions en file.
 * token : JWT du serveur/gérant
 * Retourne { synced, failed }
 */
export async function flushQueue(token) {
  const queue = await getQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    if (action.retries >= MAX_RETRIES) {
      // Trop d'échecs — abandonner cette action
      await removeAction(action.id);
      failed++;
      continue;
    }

    const ok = await executeAction(action, token);
    if (ok) {
      await removeAction(action.id);
      synced++;
    } else {
      await incrementRetry(action.id);
      failed++;
    }
  }

  return { synced, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HOOK useOfflineSync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook principal du mode hors-ligne.
 * - Surveille la connectivité
 * - Flush la queue automatiquement au retour en ligne
 * - Expose queueSize pour l'UI
 */
export function useOfflineSync(token) {
  const { isOnline, isChecking, recheck } = useNetworkStatus();
  const [queueSize,    setQueueSize]    = useState(0);
  const [syncing,      setSyncing]      = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const wasOfflineRef = useRef(false);

  // Mettre à jour queueSize
  const refreshQueueSize = useCallback(async () => {
    const q = await getQueue();
    setQueueSize(q.length);
  }, []);

  useEffect(() => {
    refreshQueueSize();
  }, []);

  // Flush automatique au retour en ligne
  useEffect(() => {
    if (isOnline && wasOfflineRef.current && token) {
      setSyncing(true);
      flushQueue(token)
        .then(result => {
          setLastSyncResult(result);
          refreshQueueSize();
        })
        .finally(() => setSyncing(false));
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline, token]);

  const manualFlush = useCallback(async () => {
    if (!token || syncing) return;
    setSyncing(true);
    const result = await flushQueue(token);
    setLastSyncResult(result);
    await refreshQueueSize();
    setSyncing(false);
    return result;
  }, [token, syncing]);

  return {
    isOnline,
    isChecking,
    syncing,
    queueSize,
    lastSyncResult,
    enqueue:      enqueueAction,
    flush:        manualFlush,
    recheck,
    refreshQueue: refreshQueueSize,
  };
}
