import { processArticleImages } from './process-images';
import { getDb } from '../lib/db';

async function main() {
  const db = getDb();
  const all = db.prepare("SELECT id FROM articles WHERE content_html LIKE '%<img%'").all() as { id: string }[];
  const processed = new Set(
    (db.prepare('SELECT DISTINCT article_id FROM article_images').all() as { article_id: string }[]).map(r => r.article_id)
  );
  const unprocessed = all.filter(a => !processed.has(a.id));
  
  console.log(`Found ${unprocessed.length} articles needing image processing\n`);
  
  for (const { id } of unprocessed) {
    console.log(`\n=== ${id} ===`);
    await processArticleImages(id);
  }
  console.log('\nAll done!');
}
main().catch(console.error);
