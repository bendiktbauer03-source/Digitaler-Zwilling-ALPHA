"""Bettet einen Waldgrafen-Zwilling in eine gebaute App-Seite ein.
argv: zwilling.html  vorlage.html  ziel.html  [titel]
Entfernt, was die App nicht liest (Rohbilder der Wuchsreihe, Zonen, Feinkarte), um die Seite schlank zu halten."""
import sys, re, json
quelle, vorlage, ziel = sys.argv[1:4]
titel = sys.argv[4] if len(sys.argv) > 4 else None
html = open(quelle, encoding='utf-8').read()
def block(i):
    m = re.search(r'<script[^>]*id="%s"[^>]*>(.*?)</script>' % i, html, re.S)
    return m.group(1) if m else None
d = json.loads(block('wg-daten'))
for b in d.get('wachstum', {}).get('bestaende', []):
    b.pop('bilder', None)
for k in ('zonen', 'feinkarte'):
    d.pop(k, None)
for r in d.get('reviere', []):
    f = r.get('flaeche') or {}
    r['flaeche'] = {'alter': f.get('alter')} if f else None
umbau = block('wg-umbau')
sicher = lambda s: s.replace('</', '<\\/')
teile = ['<script type="application/json" id="wg-daten">' + sicher(json.dumps(d, ensure_ascii=False, separators=(',', ':'))) + '</script>']
if umbau:
    teile.append('<script type="application/json" id="wg-umbau">' + sicher(json.dumps(json.loads(umbau), ensure_ascii=False, separators=(',', ':'))) + '</script>')
seite = open(vorlage, encoding='utf-8').read()
if titel:
    seite = re.sub(r'<title>.*?</title>', f'<title>{titel}</title>', seite)
seite = seite.replace('<div id="root"></div>', '\n'.join(teile) + '\n<div id="root"></div>')
open(ziel, 'w', encoding='utf-8').write(seite)
print(ziel, round(len(seite) / 1e6, 2), 'MB')
