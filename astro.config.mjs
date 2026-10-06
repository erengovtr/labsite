import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL ortam değişkeniyle yayın adresini verin (ör. https://blog.alanadiniz.com)
export default defineConfig({
  site: process.env.SITE_URL || 'https://bioscience-blog.example.com',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
