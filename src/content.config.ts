import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['Peptit Bilimi', 'Metabolizma', 'Hormonal Eksenler', 'Analitik Kalite', 'Temel Kavramlar']),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    readingMinutes: z.number().optional(),
    featured: z.boolean().default(false),
    compound: z.string().optional(),
    references: z.array(z.string()).default([]),
  }),
});

export const collections = { posts };
