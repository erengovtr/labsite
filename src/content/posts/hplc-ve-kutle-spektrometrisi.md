---
title: "HPLC ve kütle spektrometrisi: peptit analizinin iki ayağı"
description: "Ters faz HPLC ile saflığın, kütle spektrometrisi ile kimliğin nasıl belirlendiği ve her yöntemin sınırları."
category: "Analitik Kalite"
tags: ["HPLC", "kütle spektrometrisi", "LC-MS", "analitik kimya"]
date: 2026-09-19
references:
  - "Aguilar MI, editör. HPLC of Peptides and Proteins: Methods and Protocols. Humana Press, 2004."
  - "Aebersold R, Mann M. Mass spectrometry-based proteomics. Nature. 2003;422:198–207."
---
Peptit kalitesini değerlendirmede iki yöntem öne çıkar: **HPLC** (ne kadar saf?) ve **kütle spektrometrisi** (gerçekten beklenen molekül mü?). İkisi birbirinin yerine geçmez; birlikte okunurlar.

## Ters faz HPLC nasıl çalışır?

Numune, apolar (genellikle C18) bir kolondan geçirilir. Mobil faz suyla başlar ve asetonitril oranı kademeli artırılır (gradyan). Daha hidrofobik moleküller kolona daha güçlü tutunur ve daha geç çıkar. Çıkış anında bir **UV dedektörü** sinyal verir; peptit bağı 214–220 nm’de iyi absorbe eder. Trifloroasetik asit (TFA) ya da formik asit gibi iyon eşleştirici katkılar pik şeklini keskinleştirir.

Sonuç bir **kromatogramdır**; saflık, ana pik alanının toplam alana yüzdesi olarak raporlanır.

### HPLC’nin sınırları
- Aynı anda çıkan (koelüte) safsızlıkları ayırt edemez.
- Tüm safsızlıklar aynı UV yanıtını vermez; alan yüzdesi tam kütle yüzdesi değildir.
- Kimliği tek başına kanıtlamaz; yalnızca “bir pik” gösterir.

## Kütle spektrometrisi ne verir?

Elektrosprey iyonlaşması (ESI), peptitleri çoğunlukla **birden fazla yüklü iyon** ([M+nH]ⁿ⁺) olarak üretir. Bir kütle/yük serisi görülür; yazılım bu seriden moleküler kütleyi hesaplar (dekonvolüsyon). Ölçülen kütle, dizi bilgisinden hesaplanan kuramsal kütleyle birkaç ppm ile birkaç yüz ppm aralığında örtüşmelidir.

Tandem MS (MS/MS) ile peptit parçalanır; oluşan b ve y iyonu serileri **amino asit dizisini** doğrular. Üç dörtlü kütle spektrometrelerinde MRM (çoklu reaksiyon izleme) yöntemi, hedef bileşiğin çok seçici ve duyarlı ölçümünü sağlar.

### MS’in sınırları
- Genellikle nicel değil, **niteldir**; iyonlaşma verimi bileşiğe göre değişir.
- Aynı kütleli izomerleri (örneğin D/L değişimi) tek başına ayıramaz.

## Neden ikisi birlikte?

| Soru | Yöntem |
| --- | --- |
| Beklenen kütle var mı? | MS |
| Ana pikin payı ne kadar? | HPLC |
| Pikin altında ne var? | LC-MS (ikisinin birleşimi) |
| Dizi doğru mu? | MS/MS |
| Gerçek içerik ne kadar? | Amino asit analizi / net peptit içeriği |

Ek olarak, farklı pH veya kolonla yapılan ikinci bir HPLC, birinci yöntemde gizli kalan safsızlıkları ortaya çıkarabilir; buna **ortogonal yöntem** denir.

## Sonuç

HPLC ve MS, birbirini tamamlayan iki ölçü aracıdır. Biri “ne kadar temiz?” sorusunu, diğeri “doğru molekül mü?” sorusunu yanıtlar. Güvenilir bir analiz raporu her ikisini de ham verisiyle birlikte sunar.
