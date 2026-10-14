export const SITE = {
  name: 'Bioscience Pharma',
  tagline: 'Bilimsel Bilgi Merkezi',
  description:
    'Bioscience Pharma bileşiklerine ilişkin hakemli literatüre, resmî ilaç kayıtlarına ve klinik çalışma verilerine dayanan bilimsel bilgi merkezi.',
  email: 'support@assistsupps.com',
};

export const CATEGORIES = [
  { name: 'Peptit Bilimi', slug: 'peptit-bilimi', blurb: 'Peptitlerin yapısı, sinyal yolları ve literatürü.' },
  { name: 'Metabolizma', slug: 'metabolizma', blurb: 'Enerji, glukoz ve iştah biyolojisi.' },
  { name: 'Hormonal Eksenler', slug: 'hormonal-eksenler', blurb: 'Büyüme hormonu, androjenler ve geri bildirim döngüleri.' },
  { name: 'Analitik Kalite', slug: 'analitik-kalite', blurb: 'HPLC, kütle spektrometrisi ve analiz sertifikaları.' },
  { name: 'Temel Kavramlar', slug: 'temel-kavramlar', blurb: 'Diğer yazıların dayandığı temel bilgiler.' },
  { name: 'Küçük Moleküller', slug: 'kucuk-molekuller', blurb: 'Peptit olmayan bileşiklerin etki yolları.' },
  { name: 'Vitamin ve Mineraller', slug: 'vitamin-ve-mineraller', blurb: 'Takviye bileşiklerinin biyokimyası.' },
] as const;

export const slugOf = (name: string) => CATEGORIES.find((c) => c.name === name)?.slug ?? '';

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export const readingTime = (text: string) => Math.max(2, Math.round(text.split(/\s+/).length / 200));
