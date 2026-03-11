import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';

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

}

// Helper functions
export function getArticles(includeArchived = false) {
  const db = getDb();
  if (includeArchived) {
    return db.prepare(`
      SELECT id, title, source, date_added, excerpt, is_read, COALESCE(is_archived, 0) as is_archived,
        CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes
      FROM articles ORDER BY date_added DESC
    `).all();
  }
  return db.prepare(`
    SELECT id, title, source, date_added, excerpt, is_read, COALESCE(is_archived, 0) as is_archived,
      CASE WHEN notes != '' THEN 1 ELSE 0 END as has_notes
    FROM articles WHERE COALESCE(is_archived, 0) = 0 ORDER BY date_added DESC
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
  const content_html = article.content_html
    || (article.content_markdown ? (marked.parse(article.content_markdown) as string) : '');
  const search_text = `${article.title} ${article.author || ''} ${article.source} ${article.content_markdown || ''}`;

  db.prepare(`
    INSERT INTO articles (id, title, author, source, source_url, date_published, date_added, curator_note, content_markdown, content_html, excerpt, pdf_path, is_read, notes, search_text)
    VALUES (@id, @title, @author, @source, @source_url, @date_published, @date_added, @curator_note, @content_markdown, @content_html, @excerpt, @pdf_path, 0, '', @search_text)
  `).run({
    ...article,
    author: article.author ?? null,
    date_published: article.date_published ?? null,
    curator_note: article.curator_note ?? null,
    content_markdown: article.content_markdown ?? null,
    excerpt: article.excerpt ?? null,
    pdf_path: article.pdf_path ?? null,
    content_html,
    search_text,
  });
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
