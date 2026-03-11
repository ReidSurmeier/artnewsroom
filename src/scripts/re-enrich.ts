#!/usr/bin/env tsx

/**
 * Re-enrich articles missing content using the fixed extractor.
 */

import { getDb } from '../lib/db';
import { extractArticle } from '../lib/extractor';

async function main() {
  const db = getDb();

  const empty = db.prepare(
    "SELECT id, title, source, source_url FROM articles WHERE content_markdown IS NULL OR content_markdown = '' OR length(content_markdown) < 100"
  ).all() as { id: string; title: string; source: string; source_url: string }[];

  console.log(`Found ${empty.length} articles to enrich\n`);

  const update = db.prepare(
    'UPDATE articles SET content_markdown = ?, content_html = ?, excerpt = ?, author = ?, search_text = ? WHERE id = ?'
  );

  let enriched = 0;
  let failed = 0;

  for (const article of empty) {
    process.stdout.write(`  [${article.source}] ${article.title.slice(0, 50)}... `);

    const extracted = await extractArticle(article.source_url);

    if (extracted && extracted.content_markdown.length > 100) {
      update.run(
        extracted.content_markdown,
        extracted.content_html,
        extracted.excerpt,
        extracted.author,
        `${article.title} ${extracted.author || ''} ${article.source} ${extracted.content_markdown}`,
        article.id
      );
      console.log(`✅ (${extracted.content_markdown.length} chars)`);
      enriched++;
    } else {
      console.log('❌');
      failed++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nDone: ${enriched} enriched, ${failed} failed`);

  const stats = db.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN content_markdown IS NOT NULL AND length(content_markdown) > 100 THEN 1 ELSE 0 END) as with_content FROM articles"
  ).get() as { total: number; with_content: number };
  console.log(`Total: ${stats.total} articles, ${stats.with_content} with content`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
