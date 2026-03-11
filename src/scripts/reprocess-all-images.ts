/**
 * Reprocess images for ALL articles that have images in their content.
 *
 * Usage: npx tsx src/scripts/reprocess-all-images.ts
 */

import { getDb } from '../lib/db';
import { processArticleImages } from './process-images';

async function main() {
  const db = getDb();
  const articles = db.prepare(`
    SELECT id FROM articles
    WHERE (content_html LIKE '%<img%' OR content_markdown LIKE '%![%')
      AND content_markdown IS NOT NULL AND content_markdown != ''
  `).all() as { id: string }[];

  console.log(`Found ${articles.length} articles with images`);

  for (const article of articles) {
    console.log(`\n--- Processing: ${article.id} ---`);
    await processArticleImages(article.id);
  }

  console.log(`\nDone. Processed ${articles.length} articles.`);
}

main().catch(console.error);
