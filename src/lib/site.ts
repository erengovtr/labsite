export const SITE = {
  name: 'Bioscience',
  tagline: 'Araştırma Notları',
  description:
    'Araştırma bileşikleri üzerine bilimsel, kaynaklı ve tarafsız içerikler: etki mekanizmaları, biyolojik yollar ve analitik kalite.',
  shop: 'https://assistsupps.com/bioscience-1',
};

export const CATEGORIES = [
  { name: 'Peptit Bilimi', slug: 'peptit-bilimi', blurb: 'Peptit yapıları, sinyal yolları ve araştırma literatürü.' },
  { name: 'Metabolizma', slug: 'metabolizma', blurb: 'Enerji dengesi, glukoz ve iştah regülasyonunun biyolojisi.' },
  { name: 'Hormonal Eksenler', slug: 'hormonal-eksenler', blurb: 'GH/IGF-1, androjen reseptörü ve endokrin geri bildirim.' },
  { name: 'Analitik Kalite', slug: 'analitik-kalite', blurb: 'HPLC, kütle spektrometrisi ve analiz sertifikalarını okumak.' },
  { name: 'Temel Kavramlar', slug: 'temel-kavramlar', blurb: 'Araştırma dilinin temel taşları.' },
] as const;

export const slugOf = (name: string) => CATEGORIES.find((c) => c.name === name)?.slug ?? '';

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

export const readingTime = (text: string) => Math.max(2, Math.round(text.split(/\s+/).length / 200));
