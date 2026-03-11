#!/usr/bin/env tsx

/**
 * Promote top-scored candidates to articles.
 * Fetches article content via Readability, stores in DB.
 */

import { getDb, addArticle } from '../lib/db';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import crypto from 'crypto';

const turndown = new TurndownService();
const LIMIT = parseInt(process.argv[2] || '30');

async function fetchContent(url: string): Promise<{ title: string; content: string; excerpt: string; author: string | null } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.content) return null;
    return {
      title: article.title || '',
      content: article.content,
      excerpt: article.excerpt || article.textContent?.slice(0, 200) || '',
      author: article.byline || null,
    };
  } catch {
    return null;
  }
}

async function main() {
  const db = getDb();

  // Get existing article URLs to avoid dupes
  const existing = new Set(
    (db.prepare('SELECT source_url FROM articles').all() as { source_url: string }[])
      .map(r => r.source_url)
  );

  // Get top candidates
  const candidates = db.prepare(
    'SELECT url, title, source, date, score FROM candidates ORDER BY score DESC LIMIT ?'
  ).all(LIMIT) as { url: string; title: string; source: string; date: string; score: number }[];

  console.log(`Promoting top ${candidates.length} candidates...\n`);

  let success = 0;
  let failed = 0;

  for (const c of candidates) {
    if (existing.has(c.url)) {
      console.log(`  SKIP (exists): ${c.title.slice(0, 60)}`);
      continue;
    }

    process.stdout.write(`  [${c.score}] ${c.source} — ${c.title.slice(0, 50)}... `);

    const content = await fetchContent(c.url);
    const id = crypto.createHash('md5').update(c.url).digest('hex').slice(0, 12);

    if (content) {
      const markdown = turndown.turndown(content.content);
      addArticle({
        id,
        title: content.title || c.title,
        author: content.author || undefined,
        source: c.source,
        source_url: c.url,
        date_published: c.date,
        date_added: new Date().toISOString(),
        content_markdown: markdown,
        content_html: content.content,
        excerpt: content.excerpt.slice(0, 300),
      });
      console.log('✅');
      success++;
    } else {
      // Skip — don't insert metadata-only shells with no content
      console.log('⚠️ (skipped — no content)');
      failed++;
    }

    existing.add(c.url);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone: ${success} with content, ${failed} metadata-only`);

  const total = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as any).c;
  console.log(`Total articles in DB: ${total}`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
