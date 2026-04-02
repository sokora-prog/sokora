/**
 * Génère les icônes PWA 192x192 et 512x512.
 * Exécuter une fois : node generate-icons.js
 * Nécessite : npm install canvas (ou utiliser les SVG inline ci-dessous)
 */

// ── Fallback : SVG encodé en base64 si canvas non disponible ─────────────────
// Les icônes SVG sont utilisées directement si on ne peut pas générer des PNG.

const { createCanvas } = (() => {
  try { return require('canvas'); } catch { return {}; }
})();

const SIZES = [192, 512];

if (createCanvas) {
  const fs = require('fs');
  const path = require('path');

  for (const size of SIZES) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Fond navy avec coins arrondis
    const r = size * 0.2;
    ctx.fillStyle = '#1A2E4A';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Lettre S orange
    const fontSize = size * 0.55;
    ctx.fillStyle = '#F26D21';
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', size / 2, size / 2);

    const out = fs.createWriteStream(path.join(__dirname, 'icons', `icon-${size}.png`));
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log(`✓ icon-${size}.png`));
  }
} else {
  console.log('Module canvas non disponible. Créez les icônes manuellement dans public/icons/');
  console.log('Tailles requises : 192x192 et 512x512 (PNG)');
}
