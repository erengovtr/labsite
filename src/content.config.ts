import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['Peptit Bilimi', 'Metabolizma', 'Hormonal Eksenler', 'Analitik Kalite', 'Temel Kavramlar']),
    // Etiketler "#etiket" olarak görünür. Bir ürünün `tag` değeriyle eşleşen yazılar o ürün sayfasında otomatik listelenir.
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    readingMinutes: z.number().optional(),
    featured: z.boolean().default(false),
    compound: z.string().optional(),
    references: z.array(z.string()).default([]),
  }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    category: z.string(),                 // ör. "Peptit · Metabolik"
    status: z.string(),                   // ör. "Araştırma bileşiği"
    tag: z.string(),                      // yazılarla eşleşecek etiket slug'ı, ör. "retatrutide"
    order: z.number().default(100),
    facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  }),
});

export const collections = { posts, products };
