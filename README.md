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

## İçerik
- **Yazı eklemek:** `src/content/posts/<ad>.md`. `tags:` listesine yazılan etiketler `#etiket` olarak görünür.
- **Ürün eklemek:** `src/content/products/<ad>.md` (`group`: "Araştırma bileşiği" ya da "Takviye"). Ürünün `tag` değeriyle aynı etiketi taşıyan yazılar ürün sayfasında otomatik listelenir.
- **Ürün görseli:** `public/urunler/<ürün-dosya-adı>.webp` (png/jpg de olur). Dosya yoksa yer tutucu şişe çizimi gösterilir.
- **Sözlük:** `src/data/glossary.ts`. **İletişim e-postası:** `src/lib/site.ts`.

## Animasyonlar
`src/scripts/motion.ts` ve `src/styles/global.css`: açılış (TV efekti, oturum başına bir kez), kaydırma animasyonları (`data-reveal`, `data-stagger`), parallax (`data-parallax`), kayan ürün şeridi, sayfa geçişleri. `prefers-reduced-motion` açıksa kapanır.

## Yazı ilkesi
Doz, süre, protokol ya da sonuç vaadi yok; her yazıda kaynaklar listelenir. Site satışa yönlendirmez.

## Yayın
`.github/workflows/firebase-hosting.yml` her push'ta siteyi Firebase Hosting'e yayınlar (GitHub'da `FIREBASE_SERVICE_ACCOUNT` secret'ı, `FIREBASE_PROJECT_ID` ve `SITE_URL` değişkenleri gerekir).
