---
title: "HPLC ve kütle spektrometrisi: biri saflığı, diğeri kimliği söyler"
description: "Ters faz HPLC ne ölçer, ESI-MS neyi doğrular ve neden bir peptit için ikisine birden ihtiyaç duyulur?"
category: "Analitik Kalite"
tags: ["HPLC", "kütle spektrometrisi", "LC-MS", "analitik kimya"]
date: 2026-09-19
references:
  - "Aguilar MI, editör. HPLC of Peptides and Proteins: Methods and Protocols. Humana Press, 2004."
  - "Aebersold R, Mann M. Mass spectrometry-based proteomics. Nature. 2003;422:198–207."
---
Laboratuvarda bir peptit numunesine iki soru sorulur. Birincisi: içinde ne kadar başka madde var? İkincisi: bu gerçekten beklenen molekül mü? İlkine HPLC, ikincisine kütle spektrometrisi cevap verir ve biri diğerinin yerini tutmaz.

## Ters faz HPLC

Numune, yüzeyi apolar zincirlerle (genellikle C18) kaplı bir kolondan geçirilir. Taşıyıcı sıvı başta sudur ve zamanla asetonitril oranı artırılır. Hidrofobik moleküller kolona daha çok tutunur, daha geç çıkar. Çıkışı bir UV dedektörü izler. Peptit bağı 214 ile 220 nm arasında iyi ışık yuttuğu için bu bölge tercih edilir. Trifloroasetik asit ya da formik asit gibi katkılar piklerin keskinleşmesini sağlar.

Ortaya çıkan grafiğe kromatogram denir. Saflık, ana pikin toplam alana yüzdesi olarak bildirilir. Bu yöntemin üç sınırı vardır: aynı anda çıkan safsızlıkları ayıramaz, her safsızlık aynı şiddette ışık yutmaz, ve ana pikin hangi molekül olduğunu söylemez.

## Kütle spektrometrisi

Elektrosprey iyonlaşmasında peptitler çoğunlukla birden çok protonla yüklenir. Cihaz bir kütle/yük serisi görür ve yazılım bunlardan molekülün gerçek kütlesini hesaplar. Bu değer, dizi bilgisinden hesaplanan kütleyle birkaç ppm ile birkaç yüz ppm arasında örtüşmelidir.

Peptidi cihaz içinde kırıp parçalarına bakan tandem MS ise amino asit dizisini doğrular. Üç dörtlü cihazlarda MRM modu, belirli bir bileşiği çok seçici ve duyarlı biçimde ölçer.

Sınır: kütle spektrometrisi genellikle sayısal bir saflık vermez, çünkü farklı moleküller aynı verimle iyonlaşmaz. Ayrıca aynı kütleli izomerleri (örneğin D ve L formlarını) tek başına ayıramaz.

## İkisi birlikte

LC-MS, kolonu doğrudan kütle spektrometresine bağlar; böylece HPLC'deki her pikin altında hangi kütlelerin olduğu görülür. Farklı bir pH'da ya da farklı kolonla ikinci bir HPLC çalıştırmak (ortogonal yöntem), ilk koşulda üst üste binen safsızlıkları açığa çıkarabilir. Bir peptidin saflığı hakkında ciddi bir söz söylenecekse bu verilerin hepsi masada olmalıdır.
