"""Create an isolated browser test page in /tmp; never uses the real game's origin."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
for name in ['learning.js', 'game.js']:
    html = html.replace(f'<script src="{name}" defer></script>', '')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (root / 'style.css').read_text() + '</style>')
script = '\n'.join((root / name).read_text() for name in ['learning.js', 'game.js', 'tests/learning.js', 'tests/regression.js'])
script = script.replace("'kids-math-game.progress.v1'", "'kids-math-game.test.progress.v1'")
Path('/tmp/math-learning-check.html').write_text(html.replace('</body>', '<script>' + script + '</script></body>'))
print('/tmp/math-learning-check.html')
