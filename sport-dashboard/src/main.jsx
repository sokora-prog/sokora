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
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Chemin relatif : l'application fonctionne aussi bien servie à la racine
    // que sous un sous-chemin comme /sport/.
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.warn("Service worker non enregistré :", error);
    });
  });
}
