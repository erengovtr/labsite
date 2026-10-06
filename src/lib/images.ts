import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Ürün görselini otomatik bulur: public/urunler/<ürün-adı>.(png|webp|jpg|jpeg|avif)
// Dosya yoksa null döner ve yer tutucu şişe çizimi gösterilir.
export function productImage(id: string): string | null {
  for (const ext of ['png', 'webp', 'jpg', 'jpeg', 'avif']) {
    if (existsSync(join(process.cwd(), 'public', 'urunler', `${id}.${ext}`))) return `/urunler/${id}.${ext}`;
  }
  return null;
}
