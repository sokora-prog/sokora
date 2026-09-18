import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Service worker : uniquement sur une version publiée.
 *
 * En développement, il masquerait les rechargements à chaud et servirait un
 * ancien script sans prévenir — la pire façon de perdre une heure.
 */
const inNativeShell = (() => {
  try { return window.Capacitor?.isNativePlatform?.() === true; } catch { return false; }
})();

// Dans l'APK, les fichiers sont déjà embarqués et servis localement : un cache
// supplémentaire n'apporte rien et ajoute une couche où une ancienne version
// peut survivre à une mise à jour.
if (import.meta.env.PROD && !inNativeShell && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Chemin relatif : l'application fonctionne aussi bien servie à la racine
    // que sous un sous-chemin comme /sport/.
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.warn("Service worker non enregistré :", error);
    });
  });
}
