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


def build(size: int) -> None:
    pixels = rounded_square(size)
    draw_bars(pixels, size)
    path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
    write_png(path, size, size, pixels)
    print(f"  {path}  ({os.path.getsize(path)} octets)")


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Génération des icônes SOKORA Sport :")
    for size in (192, 512, 180):
        build(size)


if __name__ == "__main__":
    main()
