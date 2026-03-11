/**
 * Sanitize all existing articles — strip boilerplate, CTAs, newsletter prompts.
 * Re-renders content_html from sanitized markdown.
 *
 * Usage: npx tsx src/scripts/sanitize-all.ts
 */

import { getDb } from '../lib/db';
import { sanitizeMarkdown, sanitizeHtml } from '../lib/sanitize';
import { marked } from 'marked';

async function main() {
  const db = getDb();
  const articles = db.prepare(
    "SELECT id, content_markdown, content_html FROM articles WHERE content_markdown IS NOT NULL AND content_markdown != ''"
  ).all() as { id: string; content_markdown: string; content_html: string }[];

  console.log(`Sanitizing ${articles.length} articles...`);

  let changed = 0;

  const update = db.prepare(
    'UPDATE articles SET content_markdown = ?, content_html = ? WHERE id = ?'
  );

  for (const article of articles) {
    const cleanMd = sanitizeMarkdown(article.content_markdown);
    const cleanHtml = sanitizeHtml(await marked(cleanMd));

    if (cleanMd !== article.content_markdown) {
      const removed = article.content_markdown.length - cleanMd.length;
      console.log(`  ${article.id}: removed ${removed} chars of boilerplate`);
      update.run(cleanMd, cleanHtml, article.id);
      changed++;
    }
  }

  console.log(`\nDone. ${changed}/${articles.length} articles cleaned.`);
}

main().catch(console.error);
