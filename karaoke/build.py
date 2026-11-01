# Bundles the game into one double-clickable file: ../Starlight Stage.html
# Run after editing: python3 build.py
from pathlib import Path

here = Path(__file__).parent
html = (here / "index.html").read_text()
css = (here / "style.css").read_text()
js = {name: (here / name).read_text() for name in ("songs.js", "app.js")}
for name, code in js.items():
    assert "</script" not in code, f"{name} contains </script, which would end the inline script early"

html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}</style>")
for name, code in js.items():
    html = html.replace(f'<script src="{name}"></script>', f"<script>\n{code}</script>")
assert 'src="app.js"' not in html and 'href="style.css"' not in html, "an asset was not inlined"

out = here.parent / "Starlight Stage.html"
out.write_text(html)
print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
