# Bioscience · Araştırma Notları

Bioscience markası için Türkçe, bilimsel ve bilgilendirici blog (Astro, statik çıktı).

```bash
npm install
npm run dev      # geliştirme
npm run build    # dist/ üretir
SITE_URL=https://alanadiniz.com npm run build   # canonical/sitemap/RSS için gerçek adres
```

## Yeni yazı eklemek
`src/content/posts/` altına bir `.md` dosyası ekleyin. Alanlar `src/content.config.ts` içinde tanımlıdır
(başlık, açıklama, kategori, etiketler, tarih, `compound`, `references`). Arama, RSS, site haritası, kategori sayfaları ve
içindekiler otomatik oluşur. Sözlük terimleri `src/data/glossary.ts` içindedir.

## Editoryal kural
Kullanım, doz, protokol veya sonuç vaadi içermez; yalnızca mekanizma ve literatür özeti. Her yazıda uyarı kutusu ve kaynak listesi bulunur.

Önceki proje (SideChain Analytics doğrulama portalı) `archive/` altında saklanıyor.
