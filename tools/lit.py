#!/usr/bin/env python3
"""PubMed kayıtlarını çekip src/data/literature.json içine künye olarak yazar.

Kullanım:
  python3 tools/lit.py search "retatrutide obesity" [retmax]   # PMID listesi + başlıklar
  python3 tools/lit.py fetch 37366315 37543055                  # künyeyi kaydeder, özeti okumak için yazdırır
Özet metinleri depoya yazılmaz (telif); yalnızca künye (başlık, yazarlar, dergi, yıl, DOI, PMID) saklanır.
"""
import json, subprocess, sys, time, re, os
import xml.etree.ElementTree as ET
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, 'src', 'data', 'literature.json')
EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'

def get(url):
    for _ in range(3):
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '40', '-A', 'bioscience-notes/1.0 (literature check)', url], capture_output=True)
        if r.returncode == 0 and r.stdout: return r.stdout.decode('utf-8', 'replace')
        time.sleep(1.5)
    raise RuntimeError('fetch failed ' + url)

def load():
    return json.load(open(DB)) if os.path.exists(DB) else {}

def search(term, retmax=8):
    q = EU + 'esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=%d&term=%s' % (retmax, subprocess.run(['python3', '-c', 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))', term], capture_output=True, text=True).stdout.strip())
    for attempt in range(4):
        try:
            ids = json.loads(get(q))['esearchresult']['idlist']; break
        except (KeyError, ValueError):
            time.sleep(2 + attempt * 2)
    else:
        raise RuntimeError('PubMed araması başarısız: ' + term)
    time.sleep(0.4)
    return ids

def text(el):
    return ''.join(el.itertext()).strip() if el is not None else ''

def fetch(pmids, save=True, scratch=None):
    out = {}
    for attempt in range(4):
        xml = get(EU + 'efetch.fcgi?db=pubmed&retmode=xml&id=' + ','.join(pmids))
        try:
            root = ET.fromstring(xml); break
        except ET.ParseError:
            time.sleep(2 + attempt * 2)
    else:
        raise RuntimeError('PubMed yanıtı okunamadı: ' + ','.join(pmids))
    for art in root.findall('.//PubmedArticle'):
        pmid = text(art.find('.//MedlineCitation/PMID'))
        a = art.find('.//Article')
        authors = []
        for au in a.findall('.//AuthorList/Author'):
            ln, ini = text(au.find('LastName')), text(au.find('Initials'))
            if ln: authors.append((ln + ' ' + ini).strip())
            elif text(au.find('CollectiveName')): authors.append(text(au.find('CollectiveName')))
        doi = ''
        for i in art.findall('.//PubmedData/ArticleIdList/ArticleId'):
            if i.get('IdType') == 'doi': doi = text(i)
        year = text(a.find('.//Journal/JournalIssue/PubDate/Year')) or (re.search(r'\d{4}', text(a.find('.//Journal/JournalIssue/PubDate/MedlineDate'))) or [''])[0] if True else ''
        if not year: year = (re.search(r'\d{4}', text(art.find('.//ArticleDate/Year'))) or [''])[0] if art.find('.//ArticleDate/Year') is not None else ''
        abstract = '\n'.join((l.get('Label') + ': ' if l.get('Label') else '') + text(l) for l in a.findall('.//Abstract/AbstractText'))
        rec = {
            'pmid': pmid, 'title': text(a.find('ArticleTitle')).rstrip('.'), 'authors': authors,
            'journal': text(a.find('.//Journal/ISOAbbreviation')) or text(a.find('.//Journal/Title')), 'year': year,
            'volume': text(a.find('.//Journal/JournalIssue/Volume')), 'issue': text(a.find('.//Journal/JournalIssue/Issue')),
            'pages': text(a.find('.//Pagination/MedlinePgn')) or text(a.find('.//ELocationID')), 'doi': doi,
            'types': [text(t) for t in a.findall('.//PublicationTypeList/PublicationType')],
        }
        out[pmid] = (rec, abstract)
    if save:
        import fcntl
        with open(DB + '.lock', 'w') as lk:
            fcntl.flock(lk, fcntl.LOCK_EX)
            db = load()
            for k, (rec, _) in out.items(): db[k] = rec
            json.dump(dict(sorted(db.items())), open(DB + '.tmp', 'w'), ensure_ascii=False, indent=1)
            os.replace(DB + '.tmp', DB)
    time.sleep(0.4)
    return out

def cite(rec):
    au = rec['authors']; a = ', '.join(au[:3]) + (' et al.' if len(au) > 3 else '')
    return '%s. %s (%s) %s. %s' % (a, rec['title'], rec['year'], rec['journal'], rec['pmid'])

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        ids = search(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 8)
        for k, (rec, ab) in fetch(ids, save=False).items():
            print(k, '|', rec['year'], '|', rec['journal'], '|', rec['title'][:130], '|', ','.join(t for t in rec['types'] if t not in ('Journal Article',))[:60])
    elif cmd == 'fetch':
        for k, (rec, ab) in fetch(sys.argv[2:]).items():
            print('=' * 100); print(cite(rec)); print('DOI:', rec['doi'], '| types:', rec['types']); print(ab if ab else '(özet yok)')
