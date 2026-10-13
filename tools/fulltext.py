#!/usr/bin/env python3
"""Açık erişimli (PMC) makalelerin tam metnini Europe PMC'den çekip düz metin olarak yazdırır.

Kullanım:
  python3 tools/fulltext.py 37366315            # PMID ver; PMC'de tam metin varsa bölümleriyle birlikte yazdırır
  python3 tools/fulltext.py 37366315 --check     # yalnızca tam metin var mı bak
Çıktı depoya yazılmaz; yalnızca okumak içindir.
"""
import json, subprocess, sys, re, time
import xml.etree.ElementTree as ET

def get(url):
    for _ in range(3):
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '60', '-A', 'bioscience-notes/1.0', url], capture_output=True)
        if r.returncode == 0 and r.stdout: return r.stdout.decode('utf-8', 'replace')
        time.sleep(1.5)
    return ''

def pmcid(pmid):
    d = json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:%s%%20AND%%20SRC:MED&format=json&resultType=core' % pmid))
    r = d.get('resultList', {}).get('result', [])
    if not r: return None, False
    return r[0].get('pmcid'), r[0].get('isOpenAccess') == 'Y' or r[0].get('inEPMC') == 'Y'

def text_of(el):
    return re.sub(r'\s+', ' ', ''.join(el.itertext())).strip()

def fulltext(pmc):
    xml = get('https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML' % pmc)
    if not xml.strip().startswith('<'): return None
    root = ET.fromstring(xml)
    out = []
    def walk(sec, depth):
        t = sec.find('title')
        if t is not None: out.append('\n' + '#' * min(depth + 1, 4) + ' ' + text_of(t))
        for ch in sec:
            if ch.tag == 'p': out.append(text_of(ch))
            elif ch.tag == 'sec': walk(ch, depth + 1)
            elif ch.tag == 'table-wrap':
                cap = ch.find('.//caption')
                if cap is not None: out.append('[Tablo] ' + text_of(cap))
    body = root.find('.//body')
    if body is None: return None
    for ch in body:
        if ch.tag == 'sec': walk(ch, 1)
        elif ch.tag == 'p': out.append(text_of(ch))
    return '\n'.join(out)

if __name__ == '__main__':
    pmid = sys.argv[1]
    pmc, ok = pmcid(pmid)
    if not pmc: print('PMC kaydı yok'); sys.exit(1)
    if '--check' in sys.argv: print(pmid, pmc, 'tam metin var' if ok else 'tam metin yok'); sys.exit(0)
    t = fulltext(pmc)
    print(t if t else 'tam metin alınamadı (%s)' % pmc)
