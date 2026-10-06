// Etiket → URL slug (Türkçe karakterleri sadeleştirir): "GHK-Cu" → "ghk-cu", "MK-677" → "mk-677"
export const tagSlug = (t: string) =>
  t.toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const postHasTag = (tags: string[], slug: string) => tags.some((t) => tagSlug(t) === slug);
