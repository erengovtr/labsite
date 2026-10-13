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

## İçerik ve kaynak kuralı
Siteye hafızadan bilgi yazılmaz. Her yazı ve ürün sayfası `sources` alanında PubMed numaralarına (PMID), gerekirse `docs` alanında resmî belgelere (ilaç etiketi, çalışma kaydı) bağlanır.

1. Kaynak bulun ve künyeyi kaydedin: `python3 tools/lit.py search "terim"`, ardından `python3 tools/lit.py fetch <PMID>` (özeti ekrana yazar, künyeyi `src/data/literature.json` içine kaydeder).
2. Yalnızca okuduğunuz özette yazanları yazın. Metinde atıf `[@PMID]` biçiminde verilir; site bunu sıra numarasına çevirir.
3. `npm run check` (ya da `npm run build`) her PMID'nin kayıtlı olduğunu, her atfın kaynak listesinde bulunduğunu ve her kaynağın metinde kullanıldığını denetler; aksi halde derleme durur.

- **Yazı eklemek:** `src/content/posts/<ad>.md`. `tags:` etiketleri `#etiket` olarak görünür.
- **Ürün eklemek:** `src/content/products/<ad>.md` (`group`: "Araştırma bileşiği" ya da "Takviye"). Ürünün `tag` değeriyle aynı etiketi taşıyan yazılar ürün sayfasında otomatik listelenir.
- **Ürün görseli:** `public/urunler/<ürün-dosya-adı>.webp` (png/jpg de olur).
- **Sözlük:** `src/data/glossary.ts` (her terim bir kaynağa bağlı). **İletişim e-postası:** `src/lib/site.ts`.

## Animasyonlar
`src/scripts/motion.ts` ve `src/styles/global.css`: açılış (TV efekti, oturum başına bir kez), kaydırma animasyonları (`data-reveal`, `data-stagger`), parallax (`data-parallax`), kayan ürün şeridi, sayfa geçişleri. `prefers-reduced-motion` açıksa kapanır.

## Yazı ilkesi
Doz, süre, protokol ya da sonuç vaadi yok; her yazıda kaynaklar listelenir. Site satışa yönlendirmez.

## Yayın
`.github/workflows/firebase-hosting.yml` her push'ta siteyi Firebase Hosting'e yayınlar (GitHub'da `FIREBASE_SERVICE_ACCOUNT` secret'ı, `FIREBASE_PROJECT_ID` ve `SITE_URL` değişkenleri gerekir).
