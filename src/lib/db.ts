import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';
import { sanitizeMarkdown, sanitizeHtml } from './sanitize';

const DB_PATH = path.join(process.cwd(), 'data', 'newsroom.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initDb(db);
  return db;
}

function initDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      source TEXT NOT NULL,
      source_url TEXT NOT NULL,
      date_published TEXT,
      date_added TEXT NOT NULL,
      curator_note TEXT,
      content_markdown TEXT,
      content_html TEXT,
      excerpt TEXT,
      pdf_path TEXT,
      is_read INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      search_text TEXT
    );

    CREATE TABLE IF NOT EXISTS references_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      found_in_article_id TEXT,
      date_added TEXT NOT NULL,
      FOREIGN KEY (found_in_article_id) REFERENCES articles(id)
    );

    CREATE INDEX IF NOT EXISTS idx_articles_date_added ON articles(date_added DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
    CREATE INDEX IF NOT EXISTS idx_references_date ON references_table(date_added DESC);
  `);

  // Migration: add is_archived column if not present
  try { db.exec('ALTER TABLE articles ADD COLUMN is_archived INTEGER DEFAULT 0'); } catch {}

  // Writers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS writers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      date_added TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );
  `);

  // Annotations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      highlighted_text TEXT NOT NULL,
      note_text TEXT DEFAULT '',
      start_offset INTEGER NOT NULL,
      end_offset INTEGER NOT NULL,
      date_added TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_article ON annotations(article_id);
  `);

  // Drawings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS drawings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL UNIQUE,
      drawing_data TEXT NOT NULL,
      date_added TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );
    CREATE INDEX IF NOT EXISTS idx_drawings_article ON drawings(article_id);
  `);

  // Article images table
  db.exec(`
    CREATE TABLE IF NOT EXISTS article_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      original_url TEXT,
      ascii_art TEXT,
      bw_image_path TEXT,
      alt_text TEXT,
      position INTEGER,
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );
    CREATE INDEX IF NOT EXISTS idx_article_images_article ON article_images(article_id);
  `);
}

// Helper functions
export function getArticles(includeArchived = false) {
  const db = getDb();
  // Only return articles that have actual content (not metadata-only shells)
  const contentFilter = "AND content_markdown IS NOT NULL AND content_markdown != ''";
  if (includeArchived) {
    return db.prepare(`
      SELECT id, title, author, source, date_added, excerpt, is_read, COALESCE(is_archived, 0) as is_archived,
        CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes,
        CASE WHEN content_html LIKE '%<img%' OR content_markdown LIKE '%![%' THEN 1 ELSE 0 END as has_images,
        CASE WHEN content_markdown IS NOT NULL AND content_markdown != '' THEN 1 ELSE 0 END as has_content
      FROM articles WHERE 1=1 ${contentFilter} ORDER BY date_added DESC
    `).all();
  }
  return db.prepare(`
    SELECT id, title, author, source, date_added, excerpt, is_read, COALESCE(is_archived, 0) as is_archived,
      CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes,
      CASE WHEN content_html LIKE '%<img%' OR content_markdown LIKE '%![%' THEN 1 ELSE 0 END as has_images,
        CASE WHEN content_markdown IS NOT NULL AND content_markdown != '' THEN 1 ELSE 0 END as has_content
    FROM articles WHERE COALESCE(is_archived, 0) = 0 ${contentFilter} ORDER BY date_added DESC
  `).all();
}

export function getArchivedArticles() {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, source, date_added, excerpt, is_read, 1 as is_archived,
      CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes
    FROM articles WHERE is_archived = 1 ORDER BY date_added DESC
  `).all();
}

export function archiveArticle(id: string) {
  const db = getDb();
  db.prepare('UPDATE articles SET is_archived = 1 WHERE id = ?').run(id);
}

export function unarchiveArticle(id: string) {
  const db = getDb();
  db.prepare('UPDATE articles SET is_archived = 0 WHERE id = ?').run(id);
}

export function getArticle(id: string) {
  const db = getDb();
  return db.prepare(`
    SELECT id, title, author, source, source_url, date_published, date_added,
      curator_note, content_html, content_markdown, excerpt, pdf_path, is_read, notes
    FROM articles WHERE id = ?
  `).get(id);
}

export function markAsRead(id: string) {
  const db = getDb();
  db.prepare('UPDATE articles SET is_read = 1 WHERE id = ?').run(id);
}

export function saveNotes(id: string, notes: string) {
  const db = getDb();
  db.prepare('UPDATE articles SET notes = ? WHERE id = ?').run(notes, id);

  // Also write to file
  const notesDir = path.join(process.cwd(), 'data', 'notes');
  if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(path.join(notesDir, `${id}.md`), notes, 'utf-8');
}

export function getReferences() {
  const db = getDb();
  return db.prepare('SELECT * FROM references_table ORDER BY date_added DESC').all();
}

export function addArticle(article: {
  id: string;
  title: string;
  author?: string;
  source: string;
  source_url: string;
  date_published?: string;
  date_added: string;
  curator_note?: string;
  content_markdown?: string;
  content_html?: string;
  excerpt?: string;
  pdf_path?: string;
}) {
  const db = getDb();
  // Sanitize content before storing
  const cleanMd = article.content_markdown ? sanitizeMarkdown(article.content_markdown) : null;
  const rawHtml = article.content_html
    || (cleanMd ? (marked.parse(cleanMd) as string) : '');
  const content_html = sanitizeHtml(rawHtml);
  const content_markdown = cleanMd;
  const search_text = `${article.title} ${article.author || ''} ${article.source} ${cleanMd || ''}`;

  db.prepare(`
    INSERT INTO articles (id, title, author, source, source_url, date_published, date_added, curator_note, content_markdown, content_html, excerpt, pdf_path, is_read, notes, search_text)
    VALUES (@id, @title, @author, @source, @source_url, @date_published, @date_added, @curator_note, @content_markdown, @content_html, @excerpt, @pdf_path, 0, '', @search_text)
  `).run({
    ...article,
    author: article.author ?? null,
    date_published: article.date_published ?? null,
    curator_note: article.curator_note ?? null,
    content_markdown: content_markdown ?? null,
    excerpt: article.excerpt ?? null,
    pdf_path: article.pdf_path ?? null,
    content_html,
    search_text,
  });
}

// Writers
export function getWriters() {
  const db = getDb();
  return db.prepare('SELECT * FROM writers ORDER BY date_added DESC').all();
}

export function addWriter(name: string, notes = '') {
  const db = getDb();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date_added = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO writers (name, slug, date_added, notes) VALUES (?, ?, ?, ?)').run(name, slug, date_added, notes);
}

export function removeWriter(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM writers WHERE id = ?').run(id);
}

export function getWriterNames(): string[] {
  const db = getDb();
  return (db.prepare('SELECT name FROM writers').all() as { name: string }[]).map(w => w.name.toLowerCase());
}

// Article images
export function getArticleImages(articleId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM article_images WHERE article_id = ? ORDER BY position').all(articleId);
}

export function insertArticleImage(img: {
  article_id: string;
  original_url: string;
  ascii_art: string;
  bw_image_path: string;
  alt_text: string;
  position: number;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO article_images (article_id, original_url, ascii_art, bw_image_path, alt_text, position)
    VALUES (@article_id, @original_url, @ascii_art, @bw_image_path, @alt_text, @position)
  `).run(img);
}

export function clearArticleImages(articleId: string) {
  const db = getDb();
  db.prepare('DELETE FROM article_images WHERE article_id = ?').run(articleId);
}

// Annotations
export function getAnnotations(articleId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM annotations WHERE article_id = ? ORDER BY start_offset').all(articleId);
}

export function addAnnotation(ann: {
  article_id: string;
  highlighted_text: string;
  note_text: string;
  start_offset: number;
  end_offset: number;
}) {
  const db = getDb();
  const date_added = new Date().toISOString().slice(0, 10);
  const result = db.prepare(`
    INSERT INTO annotations (article_id, highlighted_text, note_text, start_offset, end_offset, date_added)
    VALUES (@article_id, @highlighted_text, @note_text, @start_offset, @end_offset, @date_added)
  `).run({ ...ann, date_added });
  return result.lastInsertRowid;
}

export function updateAnnotation(id: number, note_text: string) {
  const db = getDb();
  db.prepare('UPDATE annotations SET note_text = ? WHERE id = ?').run(note_text, id);
}

export function deleteAnnotation(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
}

// Drawings
export function getDrawing(articleId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM drawings WHERE article_id = ?').get(articleId);
}

export function saveDrawing(articleId: string, drawingData: string) {
  const db = getDb();
  const date_added = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO drawings (article_id, drawing_data, date_added) VALUES (?, ?, ?)
    ON CONFLICT(article_id) DO UPDATE SET drawing_data = excluded.drawing_data, date_added = excluded.date_added
  `).run(articleId, drawingData, date_added);
}

export function searchArticles(query: string) {
  const db = getDb();
  const q = `%${query}%`;
  return db.prepare(`
    SELECT id, title, source, date_added, excerpt, is_read,
      CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes
    FROM articles
    WHERE search_text LIKE ?
    ORDER BY date_added DESC
  `).all(q);
}
