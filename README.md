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

## Ürün sayfaları ve etiketler
- Ürün eklemek: `src/content/products/<ad>.md` (alanlar `src/content.config.ts` içinde; `tag` alanı yazılardaki etiketle eşleşir).
- Yazıya etiket eklemek: yazının `tags:` listesine `"retatrutide"` gibi bir değer yazın. Etiketi (`#retatrutide`) taşıyan yazılar, `tag: "retatrutide"` olan ürün sayfasında otomatik listelenir. Büyük/küçük harf ve Türkçe karakter fark etmez (`GHK-Cu` → `ghk-cu`).
- Ürün görseli: `public/urunler/<ürün-dosya-adı>.png` (ör. `retatrutide.png`, `ghk-cu.png`). Dosya yoksa yer tutucu şişe çizimi görünür; png/webp/jpg/jpeg/avif desteklenir.

## Animasyonlar
`src/scripts/motion.ts` + `src/styles/global.css`: TV efektli açılış (oturum başına bir kez; tıklayınca geçilir), kaydırma animasyonları (`data-reveal`, `data-stagger`), parallax (`data-parallax`), kayan ürün şeridi, sayfa geçişleri (View Transitions). `prefers-reduced-motion` açıksa hepsi kapanır.

## Editoryal kural
Kullanım, doz, protokol veya sonuç vaadi içermez; yalnızca mekanizma ve literatür özeti. Her yazıda uyarı kutusu ve kaynak listesi bulunur.

Önceki proje (SideChain Analytics doğrulama portalı) `archive/` altında saklanıyor.
