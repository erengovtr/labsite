import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/site';
export async function GET(context: { site: URL }) {
  const posts = (await getCollection('posts')).sort((a, b) => +b.data.date - +a.data.date);
  return rss({
    title: `${SITE.name} ${SITE.tagline}`, description: SITE.description, site: context.site,
    items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: `/yazilar/${p.id}/` })),
  });
}
