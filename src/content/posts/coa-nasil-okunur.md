---
title: "Analiz sertifikası (CoA) nasıl okunur? Saflık, içerik ve kimlik farkı"
description: "Bir CoA’daki testler neyi ölçer, “%99 saflık” ne anlama gelir ve belgede hangi unsurlar güvenilirliği artırır ya da azaltır?"
category: "Analitik Kalite"
tags: ["CoA", "saflık", "net peptit içeriği", "endotoksin"]
date: 2026-10-05
references:
  - "ICH Q2(R2) Validation of Analytical Procedures. International Council for Harmonisation, 2023."
  - "ISO/IEC 17025:2017 General requirements for the competence of testing and calibration laboratories."
  - "United States Pharmacopeia. <85> Bacterial Endotoxins Test."
---
Analiz sertifikası (Certificate of Analysis, CoA), belirli bir **partinin** test sonuçlarını bildiren belgedir. Ancak bir CoA’nın varlığı tek başına kalite kanıtı değildir; içeriğini okuyabilmek gerekir. Bu yazı, tipik bir peptit CoA’sının bölümlerini ve nelere dikkat edileceğini anlatıyor.

## Bir CoA’da bulunması beklenen testler

| Test | Ne sorar? | Tipik yöntem |
| --- | --- | --- |
| Görünüm | Fiziksel tanım | Gözle inceleme |
| Kimlik | Doğru molekül mü? | Kütle spektrometrisi (ölçülen / kuramsal kütle) |
| Kromatografik saflık | Pikin toplam içindeki payı | RP-HPLC, genellikle 214–220 nm |
| Net peptit içeriği | Tozun ne kadarı peptit? | Amino asit analizi, azot analizi |
| Su içeriği | Kalıntı nem | Karl Fischer |
| Karşı iyon | Asetat, TFA vb. | İyon kromatografisi |
| Endotoksin | Bakteriyel kirlilik | LAL testi (EU/mL veya EU/mg) |
| Ağır metal / çözücü kalıntısı | Safsızlık | ICP-MS, GC |

Her testin yöntem adı ve sonuç birimi belirtilmelidir.

## “%99 saflık” ne demektir, ne demez?

**Kromatografik saflık**, HPLC kromatogramındaki ana pikin toplam pik alanına oranıdır. Bu, tozun %99’unun peptit olduğu anlamına **gelmez**. Liyofilize tozda tuz (karşı iyon) ve su da bulunur; bu yüzden net peptit içeriği genellikle %70–90 aralığında olabilir. İki farklı kavramdır:

- *Saflık:* Peptit kaynaklı safsızlıklar arasında ana ürünün payı.
- *İçerik:* Toplam kütle içinde gerçek peptit payı.

Etiket miktarı (örneğin “5 mg”), net peptit mi yoksa toplam toz mu olduğunu açıkça belirtmelidir; aksi hâlde etiket ile gerçek içerik arasında fark oluşabilir.

## Güvenilirliği artıran unsurlar

- Parti/lot numarası ve üretim-analiz tarihi
- Testi yapan **laboratuvarın adı**, mümkünse ISO/IEC 17025 akreditasyonu
- Ham kromatogram ve kütle spektrumunun eklenmesi (yalnızca sonuç tablosu değil)
- Yöntem, kolon, dalga boyu ve kabul ölçütlerinin belirtilmesi
- Belgeyi doğrulama yolu (örneğin düzenleyen laboratuvara sorgu veya benzersiz bir doğrulama kodu)

## Dikkat edilmesi gereken işaretler

- Parti numarası yok ya da farklı partilerde birebir aynı sonuçlar
- Kromatogram olmadan yalnızca “≥99%” gibi yuvarlak değerler
- Testi yapan laboratuvarın belirtilmemesi veya doğrulanamaması
- Kimlik testi sonucu olarak yalnızca “uygun” yazılması, ölçülen kütle değerinin bulunmaması
- Endotoksin ve steriliteye dair hiçbir veri bulunmaması

## Sonuç

Bir CoA, ancak kimlik, saflık ve içeriği birbirinden ayırıp yöntemini ve kaynağını açıkça gösterdiğinde anlamlıdır. Okurken “bu sayı neyi ölçüyor, kim ölçmüş ve ham veriyle desteklenmiş mi?” sorularını sormak yeterli bir başlangıçtır.
