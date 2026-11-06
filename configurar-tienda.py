"""
Configura una tienda nueva a partir de la base.

Uso (una sola vez, en la copia del cliente):
    1. Copiar cliente.ejemplo.json como cliente.json y completarlo.
    2. python configurar-tienda.py

Reemplaza los marcadores de la base ("Mi Tienda", https://mi-tienda.netlify.app,
TU-PROYECTO, 5491100000000...) por los datos del cliente en todas las páginas,
la configuración, el mapa del sitio y la política de seguridad.
Lo que queda para hacer a mano lo muestra al final.
"""

import json
import os
import re
import sys

BASE_FILES = (".html", ".js", ".xml", ".txt", ".ts", "_headers")

# Mapa de la base (Tortuguitas). Se reemplaza por el del cliente si lo carga.
BASE_MAP = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d43648.563503690886"

REQUIRED = ["nombre", "id", "descripcion", "sitio", "supabase_url", "supabase_clave_publica",
            "whatsapp", "whatsapp_visible", "instagram", "ciudad", "provincia",
            "alias", "titular", "horario", "mapa_embed"]


def fail(message):
    print(f"\nError: {message}")
    sys.exit(1)


def load_client():
    if not os.path.exists("cliente.json"):
        fail("no existe cliente.json. Copiá cliente.ejemplo.json como cliente.json y completalo.")

    with open("cliente.json", encoding="utf-8") as file:
        data = json.load(file)

    missing = [key for key in REQUIRED if key not in data]
    if missing:
        fail(f"faltan estos datos en cliente.json: {', '.join(missing)}")

    data = {key: str(value).strip() for key, value in data.items() if not key.startswith("_")}
    data["sitio"] = data["sitio"].rstrip("/")
    data["supabase_url"] = data["supabase_url"].rstrip("/")

    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", data["id"]):
        fail('"id" va en minúsculas, sin espacios ni acentos (por ejemplo "velas-luz").')
    if not data["sitio"].startswith("https://"):
        fail('"sitio" tiene que empezar con https:// (por ejemplo https://velas-luz.netlify.app).')
    if not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", data["supabase_url"]):
        fail('"supabase_url" tiene que ser como https://abcdefgh.supabase.co (Project Settings > API).')
    if not re.fullmatch(r"549\d{10}", data["whatsapp"]):
        fail('"whatsapp" va solo con números: 549 + código de área + número (por ejemplo 5491122223333).')
    if data["mapa_embed"] and not data["mapa_embed"].startswith("https://www.google.com/maps/embed?"):
        fail('"mapa_embed" es el enlace de "Insertar un mapa" de Google Maps (empieza con https://www.google.com/maps/embed?). Dejalo vacío para no cambiarlo.')

    return data


def text_files():
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules")]
        for name in files:
            if name.endswith(BASE_FILES):
                yield os.path.join(root, name)


def main():
    data = load_client()

    if not any("https://mi-tienda.netlify.app" in open(f, encoding="utf-8").read() for f in text_files()):
        fail("esta copia ya parece configurada (no quedan marcadores de la base). No se cambió nada.")

    project = data["supabase_url"].removeprefix("https://").removesuffix(".supabase.co")

    # El orden importa: primero lo más largo y específico.
    replacements = [
        ("Comprá online en Mi Tienda y coordiná tu pedido por WhatsApp.", data["descripcion"]),
        ("Tienda online de Mi Tienda.", data["descripcion"]),
        ("https://mi-tienda.netlify.app", data["sitio"]),
        ("TU-PROYECTO", project),
        ("TU-CLAVE-PUBLICA", data["supabase_clave_publica"]),
        ("+54 9 11 0000-0000", "+" + data["whatsapp"]),
        ("5491100000000", data["whatsapp"]),
        ("11 0000-0000", data["whatsapp_visible"]),
        ("instagram.com/mitienda", "instagram.com/" + data["instagram"]),
        ("@mitienda", "@" + data["instagram"]),
        ('instagram: "mitienda"', f'instagram: "{data["instagram"]}"'),
        ("arroba mitienda", "arroba " + data["instagram"]),
        ('id: "mi-tienda"', f'id: "{data["id"]}"'),
        ("Tu ciudad", data["ciudad"]),
        ("Buenos Aires", data["provincia"]),
        ("MI TIENDA", data["nombre"].upper()),
        ("Mi Tienda", data["nombre"]),
    ]

    changed = []

    for path in text_files():
        with open(path, encoding="utf-8") as file:
            original = file.read()

        text = original
        for old, new in replacements:
            text = text.replace(old, new)

        if data["mapa_embed"]:
            text = re.sub(re.escape(BASE_MAP) + r'[^"]*', data["mapa_embed"], text)

        if path.endswith("tienda-config.js"):
            text = re.sub(r'alias: "[^"]*"', f'alias: "{data["alias"]}"', text, count=1)
            text = re.sub(r'titular: "[^"]*"', f'titular: "{data["titular"]}"', text, count=1)
            text = re.sub(r'horario: "[^"]*"', f'horario: "{data["horario"]}"', text, count=1)

        if text != original:
            with open(path, "w", encoding="utf-8", newline="") as file:
                file.write(text)
            changed.append(path)

    print(f"\nListo: se configuraron {len(changed)} archivos para {data['nombre']}.\n")
    print("Falta hacer a mano (ver NUEVO-CLIENTE.md):")
    print("  1. Colores y tipografías: styles/tema.css")
    print("  2. Opciones de producto, entregas y guía de talles: scripts/tienda-config.js")
    print("  3. Imágenes: img/banners/*, img/nosotros.jpg e img/favicon.svg")
    print("  4. Textos propios: Pages/nosotros.html, preguntas de Pages/contacto.html y el inicio")
    print("  5. Supabase: ejecutar supabase/schema.sql y crear el usuario administrador")
    print("  6. Publicar en Netlify y registrar el sitio en Google Search Console")


if __name__ == "__main__":
    main()
