#!/usr/bin/env python3
"""
Génère les icônes PWA de SOKORA Sport.

Écrit les PNG directement (zlib + struct de la bibliothèque standard) : aucune
dépendance à installer, et le résultat est reproductible — relancer le script
sur une autre machine produit des fichiers identiques.

    python3 sport-dashboard/scripts/generate_icons.py

Produit, dans sport-dashboard/public/icons/ :
    icon-192.png   icône Android / manifeste
    icon-512.png   icône haute définition et écran de démarrage
    icon-180.png   apple-touch-icon (iOS ignore le manifeste pour cela)
"""

import math
import os
import struct
import zlib

# Bleu de la série 1 du tableau de bord, pour que l'icône et l'application
# parlent la même langue visuelle.
BACKGROUND = (0x2A, 0x78, 0xD6)
INK = (0xFC, 0xFC, 0xFB)

OUTPUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "icons"
)


def write_png(path: str, width: int, height: int, pixels) -> None:
    """Écrit un PNG RGBA sans perte."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filtre « None » pour cette ligne
        for x in range(width):
            raw.extend(pixels[y][x])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def rounded_square(size: int, radius_ratio: float = 0.22):
    """Fond bleu à coins arrondis, opaque au centre, transparent aux angles."""
    radius = size * radius_ratio
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            # Distance au rectangle intérieur : nulle partout sauf dans les coins.
            dx = max(radius - x, 0, x - (size - 1 - radius))
            dy = max(radius - y, 0, y - (size - 1 - radius))
            distance = math.hypot(dx, dy)
            if distance <= radius - 0.5:
                alpha = 255
            elif distance >= radius + 0.5:
                alpha = 0
            else:
                # Bord antialiasé sur un pixel.
                alpha = int(round((radius + 0.5 - distance) * 255))
            pixels[y][x] = (*BACKGROUND, alpha)
    return pixels


def draw_bars(pixels, size: int) -> None:
    """Trois barres montantes : le graphique est le sujet de l'application."""
    # Proportions exprimées en fraction de la taille, pour rester net à 192 comme à 512.
    bar_width = 0.13
    gap = 0.075
    left = 0.245
    baseline = 0.735
    heights = (0.20, 0.34, 0.48)

    for index, height in enumerate(heights):
        x0 = int(round((left + index * (bar_width + gap)) * size))
        x1 = int(round((left + index * (bar_width + gap) + bar_width) * size))
        y1 = int(round(baseline * size))
        y0 = int(round((baseline - height) * size))
        for y in range(max(0, y0), min(size, y1)):
            for x in range(max(0, x0), min(size, x1)):
                base = pixels[y][x]
                if base[3] == 0:
                    continue
                pixels[y][x] = (*INK, base[3])


def circle(size: int):
    """Même fond, mais disque : Android réclame une variante ronde."""
    radius = size / 2
    centre = (size - 1) / 2
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]
    for y in range(size):
        for x in range(size):
            distance = math.hypot(x - centre, y - centre)
            if distance <= radius - 0.5:
                alpha = 255
            elif distance >= radius + 0.5:
                alpha = 0
            else:
                alpha = int(round((radius + 0.5 - distance) * 255))
            pixels[y][x] = (*BACKGROUND, alpha)
    return pixels


def adaptive_foreground(size: int):
    """
    Calque avant d'une icône adaptative : les barres seules, sur fond
    transparent (la couleur vient de `ic_launcher_background`).

    Android rogne librement le pourtour et ne garantit que les deux tiers
    centraux. On dessine donc le motif dans cette zone sûre, sans quoi les
    barres seraient amputées sur les lanceurs qui découpent en cercle.
    """
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]
    safe = int(round(size * 2 / 3))

    # Les barres sont dessinées sur un carré opaque temporaire, puis reportées :
    # `draw_bars` respecte l'alpha du fond, ce qui permet de réutiliser le même
    # tracé que l'icône web au lieu d'en maintenir deux.
    #
    # Dans l'icône web, le motif n'occupe qu'environ la moitié du carré, le
    # reste étant du bleu. Reporté tel quel, il donnerait un pictogramme perdu
    # au milieu du vide. On dessine donc sur un tampon plus grand, on mesure
    # l'emprise réelle de l'encre, et on la recadre au centre de la zone sûre :
    # le motif la remplit, quelles que soient les proportions choisies plus haut.
    stamp_size = int(round(safe / 0.55))
    stamp = [[(*BACKGROUND, 255)] * stamp_size for _ in range(stamp_size)]
    draw_bars(stamp, stamp_size)

    inked = [
        (x, y)
        for y in range(stamp_size)
        for x in range(stamp_size)
        if stamp[y][x][:3] == INK
    ]
    if not inked:
        return pixels
    x0 = min(p[0] for p in inked)
    x1 = max(p[0] for p in inked)
    y0 = min(p[1] for p in inked)
    y1 = max(p[1] for p in inked)

    dx = (size - (x1 - x0 + 1)) // 2 - x0
    dy = (size - (y1 - y0 + 1)) // 2 - y0
    for x, y in inked:
        tx, ty = x + dx, y + dy
        if 0 <= tx < size and 0 <= ty < size:
            pixels[ty][tx] = (*INK, 255)
    return pixels


#: densité → (taille du lanceur, taille du calque adaptatif)
ANDROID_DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

ANDROID_RES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "android", "app", "src", "main", "res",
)


def build(size: int) -> None:
    pixels = rounded_square(size)
    draw_bars(pixels, size)
    path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
    write_png(path, size, size, pixels)
    print(f"  {path}  ({os.path.getsize(path)} octets)")


def build_android() -> None:
    """Remplace les icônes par défaut de Capacitor par celles de l'application."""
    if not os.path.isdir(ANDROID_RES_DIR):
        print("  (projet Android absent — exécuter `npx cap add android` d'abord)")
        return

    for density, (launcher, foreground) in ANDROID_DENSITIES.items():
        folder = os.path.join(ANDROID_RES_DIR, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)

        square = rounded_square(launcher)
        draw_bars(square, launcher)
        write_png(os.path.join(folder, "ic_launcher.png"), launcher, launcher, square)

        disc = circle(launcher)
        draw_bars(disc, launcher)
        write_png(os.path.join(folder, "ic_launcher_round.png"), launcher, launcher, disc)

        layer = adaptive_foreground(foreground)
        write_png(
            os.path.join(folder, "ic_launcher_foreground.png"),
            foreground, foreground, layer,
        )
        print(f"  mipmap-{density} : {launcher}px + calque {foreground}px")

    # Le fond de l'icône adaptative doit être le bleu de la marque, faute de
    # quoi les barres blanches se détachent sur le blanc par défaut.
    colour = os.path.join(ANDROID_RES_DIR, "values", "ic_launcher_background.xml")
    os.makedirs(os.path.dirname(colour), exist_ok=True)
    with open(colour, "w", encoding="utf-8") as handle:
        handle.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n'
            "</resources>\n" % BACKGROUND
        )
    print(f"  {colour}")


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Génération des icônes SOKORA Sport :")
    for size in (192, 512, 180):
        build(size)
    print("Icônes Android :")
    build_android()


if __name__ == "__main__":
    main()
