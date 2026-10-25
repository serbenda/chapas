"""Descarga las fuentes de Google Fonts y las sirve desde la propia web.

Así el juego publicado no hace ninguna petición a servidores de Google
(ni les envía la IP de quien juega). Se ejecuta al publicar en GitHub Pages.

Uso: python3 scripts/fuentes_locales.py _site   (carpeta con una copia de web/)
"""
import re
import sys
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def bajar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main(sitio: Path) -> None:
    index = sitio / "index.html"
    html = index.read_text(encoding="utf-8")
    m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)">', html)
    if not m:
        print("No hay fuentes de Google que copiar")
        return
    css = bajar(m.group(1).replace("&amp;", "&")).decode("utf-8")
    carpeta = sitio / "fonts"
    carpeta.mkdir(exist_ok=True)
    urls = sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css)))
    for i, url in enumerate(urls):
        nombre = f"f{i:02d}{Path(url).suffix or '.woff2'}"
        (carpeta / nombre).write_bytes(bajar(url))
        css = css.replace(url, nombre)
    (carpeta / "fuentes.css").write_text(css, encoding="utf-8")
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\n?', "", html)
    html = html.replace(m.group(0), '<link rel="stylesheet" href="fonts/fuentes.css">')
    index.write_text(html, encoding="utf-8")
    print(f"{len(urls)} archivos de fuentes copiados a {carpeta}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
