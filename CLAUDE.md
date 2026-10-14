# Bioscience Pharma Bilimsel Bilgi Merkezi: proje notları

Astro 7 statik sitesi (Türkçe), Firebase Hosting'e GitHub Action ile yayınlanır (`main` ve `claude/funny-heisenberg-ircnsn` dallarına push = deploy). Önce README.md'yi oku.

## Değişmez editoryal kurallar
- Tamamen bilimsel bilgi sitesi: kullanım, doz, protokol, kombinasyon, temin önerisi YOK; satışa veya mağazaya bağlantı YOK.
- Her bilgi gerçek, okunmuş kaynaktan gelir (PubMed, açık erişimli tam metin, DailyMed/Drugs@FDA, ClinicalTrials.gov, PubChem). Hafızadan bilgi yazma; doğrulanamayanı çıkar veya "doğrulanamadı" de.
- Hücre, hayvan ve insan verisi ayrı anlatılır; küçük örneklem, çıkar ilişkisi, tek grup kaynağı gibi sınırlar yazılır.
- Ton: kurumsal, akademik, nötr Türkçe. Emoji, abartı, "AI" kalıpları yok.

## Araçlar
- `python3 tools/lit.py search "<sorgu>" 10` / `fetch <PMID...>`: künyeyi `src/data/literature.json`'a yazar, özeti yazdırır.
- `python3 tools/fulltext.py <PMID>`: Europe PMC açık erişim tam metni.
- Metinde atıf: `[@PMID]`; PMID frontmatter `sources` içinde olmalı, her kaynak en az bir kez atıf almalı. `python3 tools/check.py` (build öncesi otomatik) bunu denetler.
- İçerik: `src/content/posts/*.md` (uzun makaleler), `src/content/products/*.md` (bileşik sayfaları; görsel `public/urunler/<id>.webp` otomatik bulunur), `src/data/glossary.ts`.

## Durum (2026-10-14)
- 96 ürün sayfası, 32 makale yayında; yeni kurumsal tasarım yayında.
- `wip/ince-isci-yarim` dalı: yarıda kalan "ince işçilik" turundan 6 makale + selank düzenlemesi (deploy edilmedi; `git diff` ile incele, beğendiğini al).
- Sıradaki iş (ince işçilik): sayfaları tek tek ele al: her atfı kaynağından yeniden doğrula, makaleleri 3000+ kelimeye derinleştir (çalışma özet tablosu, iç bağlantılar), ürün sayfalarını 500-900 kelimeye ve 8-12 bilgi satırına çıkar, resmî durumu (onay/kayıt) yeniden kontrol et, sözlüğü genişlet.
- Açık notlar: mağazadaki "PF-06260414" etiketli ürün aslında pemafibrat (sayfa pemafibrat üzerine). İletişim e-postası support@assistsupps.com. Alan adı alındığında `SITE_URL` değişkenini ve robots.txt'yi güncelle.
