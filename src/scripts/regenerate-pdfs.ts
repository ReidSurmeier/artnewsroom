#!/usr/bin/env npx tsx
/**
 * Regenerate PDFs for all articles that have content_markdown.
 * Uses the updated generatePdf function with improved formatting.
 */
import { generatePdf } from '../lib/scraper';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const db = new Database(path.join(process.cwd(), 'data', 'newsroom.db'));

interface ArticleRow {
  id: string;
  title: string;
  author: string | null;
  source: string | null;
  content_markdown: string;
  pdf_path: string | null;
}

const articles = db.prepare(`
  SELECT id, title, author, source, content_markdown, pdf_path
  FROM articles
  WHERE content_markdown IS NOT NULL AND length(content_markdown) > 0
`).all() as ArticleRow[];

console.log(`Found ${articles.length} articles with content to regenerate PDFs for.\n`);

const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

let success = 0;
let failed = 0;

async function main() {
for (const article of articles) {
  // Build slug-based filename if the ID is a hash
  const slug = article.id.includes('_') ? article.id : 
    article.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);
  const pdfFilename = `${slug}.pdf`;
  const pdfPath = `data/pdfs/${pdfFilename}`;
  const pdfFullPath = path.join(process.cwd(), pdfPath);

  const pdfContent = [
    article.title,
    article.author ? `By ${article.author}` : '',
    article.source ? `Source: ${article.source}` : '',
    '',
    article.content_markdown,
  ].filter(Boolean).join('\n');

  try {
    await generatePdf(pdfContent, pdfFullPath);
    // Update the pdf_path in the DB
    db.prepare('UPDATE articles SET pdf_path = ? WHERE id = ?').run(pdfPath, article.id);
    success++;
    process.stdout.write(`✓ ${article.title.slice(0, 60)}\n`);
  } catch (err: any) {
    failed++;
    process.stdout.write(`✗ ${article.title.slice(0, 60)}: ${err.message}\n`);
  }
}

console.log(`\nDone: ${success} succeeded, ${failed} failed out of ${articles.length} total.`);
}

main().catch(console.error);
