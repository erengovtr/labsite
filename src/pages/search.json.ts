import { getCollection } from 'astro:content';
export async function GET() {
  const posts = await getCollection('posts');
  return new Response(JSON.stringify(posts.map((p) => ({
    id: p.id, title: p.data.title, description: p.data.description, category: p.data.category,
    tags: p.data.tags, compound: p.data.compound ?? null,
  }))), { headers: { 'Content-Type': 'application/json' } });
}
