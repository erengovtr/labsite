import { getCollection } from 'astro:content';
export async function GET() {
  const posts = await getCollection('posts');
  const products = await getCollection('products');
  const items = [
    ...products.map((p) => ({ type: 'Ürün', url: `/urunler/${p.id}/`, title: p.data.name, description: p.data.tagline, category: p.data.category, tags: [p.data.tag] })),
    ...posts.map((p) => ({ type: 'Yazı', url: `/yazilar/${p.id}/`, title: p.data.title, description: p.data.description, category: p.data.category, tags: p.data.tags })),
  ];
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
