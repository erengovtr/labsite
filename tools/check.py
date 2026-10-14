#!/usr/bin/env python3
"""Yayın öncesi kaynak denetimi:
 - yazı/ürün frontmatter'ındaki her PMID literature.json'da var mı?
 - metindeki [n] atıfları sources sırasına karşılık geliyor mu (n <= kaynak sayısı)?
 - kaynaksız yazı/ürün var mı?
"""
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lit = json.load(open(os.path.join(ROOT, 'src/data/literature.json')))
bad = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'src/content/posts/*.md')) + glob.glob(os.path.join(ROOT, 'src/content/products/*.md'))):
    t = open(f, encoding='utf-8').read()
    fm, body = (t.split('---', 2)[1], t.split('---', 2)[2])
    m = re.search(r'^sources:\s*\[(.*?)\]', fm, re.M | re.S)
    src = re.findall(r'"?(\d+)"?', m.group(1)) if m else []
    name = os.path.relpath(f, ROOT)
    wip = re.search(r'^status:\s*"Hazırlanıyor"', fm, re.M)
    if not src and not wip: print('KAYNAK YOK  ', name); bad += 1
    for p in src:
        if p not in lit: print('PMID EKSİK  ', name, p); bad += 1
    cited = set(re.findall(r'\[@(\d+)\]', body)) | set(re.findall(r'\[@(\d+)\]', fm))
    for p in cited - set(src): print('ATIF KAYNAKTA YOK', name, p); bad += 1
    for p in set(src) - cited: print('ATIF YAPILMAMIŞ ', name, p, '(kaynak listede ama metinde atıf yok)'); bad += 1
    for n in set(re.findall(r'(?<!@)\[(\d{1,2})\](?!\()', body)): print('ESKİ BİÇİM [n]   ', name, n); bad += 1
if bad: print('\n%d sorun' % bad); sys.exit(1)
print('kaynak denetimi temiz')
