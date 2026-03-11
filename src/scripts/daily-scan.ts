#!/usr/bin/env tsx

/**
 * Daily RSS scan script.
 * Scans all RSS feeds, filters to new articles not already in DB, stores candidates.
 *
 * Usage:
 *   npx tsx src/scripts/daily-scan.ts
 *
 * Intended to run via cron at 8am daily.
 */

import { scanFeeds, type FeedItem } from '../lib/rss';
import { getDb } from '../lib/db';
import { rankItems } from '../lib/taste-scorer';

async function main() {
  const startTime = Date.now();
  console.log(`\n── Daily RSS Scan ──`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Scan all feeds
  const items = await scanFeeds();

  if (items.length === 0) {
    console.log('[scan] No items found across any feeds.');
    return;
  }

  // Get existing URLs from DB to dedup
  const db = getDb();
  const existing = new Set(
    (db.prepare('SELECT source_url FROM articles').all() as { source_url: string }[])
      .map(r => r.source_url)
  );

  // Filter to new articles
  const newItems = items.filter(item => !existing.has(item.url));

  console.log(`\n── Results ──`);
  console.log(`Total items from feeds: ${items.length}`);
  console.log(`Already in DB:          ${items.length - newItems.length}`);
  console.log(`New candidates:         ${newItems.length}`);

  if (newItems.length === 0) {
    console.log('\nNo new articles to process.');
    return;
  }

  // Group by source for readability
  const bySource = new Map<string, FeedItem[]>();
  for (const item of newItems) {
    const list = bySource.get(item.source) || [];
    list.push(item);
    bySource.set(item.source, list);
  }

  console.log(`\n── New articles by source ──`);
  for (const [source, sourceItems] of bySource) {
    console.log(`\n${source} (${sourceItems.length}):`);
    for (const item of sourceItems.slice(0, 5)) {
      const date = new Date(item.date).toISOString().split('T')[0];
      console.log(`  ${date}  ${item.title}`);
      console.log(`          ${item.url}`);
    }
    if (sourceItems.length > 5) {
      console.log(`  ... and ${sourceItems.length - 5} more`);
    }
  }

  // Score candidates against taste profile
  console.log(`\n── Scoring against taste profile ──`);
  const scored = rankItems(newItems);

  // Show top 15 highest-scoring articles
  console.log(`\nTop 15 matches:`);
  for (const item of scored.slice(0, 15)) {
    const date = new Date(item.date).toISOString().split('T')[0];
    const breakdown = `d:${item.scoreBreakdown.domain} k:${item.scoreBreakdown.keywords} s:${item.scoreBreakdown.source} r:${item.scoreBreakdown.recency}`;
    console.log(`  [${item.score.toString().padStart(2)}] ${item.source} — ${item.title.slice(0, 70)}`);
    console.log(`       ${date}  (${breakdown})`);
  }

  // Store candidates in a simple candidates table for later AI curation
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      score_breakdown TEXT,
      scanned_at TEXT NOT NULL
    )
  `);

  // Add score column if it doesn't exist (migration for existing DBs)
  try { db.exec(`ALTER TABLE candidates ADD COLUMN score INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE candidates ADD COLUMN score_breakdown TEXT`); } catch {}

  const insertCandidate = db.prepare(`
    INSERT OR IGNORE INTO candidates (url, title, source, date, score, score_breakdown, scanned_at)
    VALUES (@url, @title, @source, @date, @score, @score_breakdown, @scanned_at)
  `);

  const scannedAt = new Date().toISOString();
  const insertMany = db.transaction((items: typeof scored) => {
    for (const item of items) {
      insertCandidate.run({
        url: item.url,
        title: item.title,
        source: item.source,
        date: item.date,
        score: item.score,
        score_breakdown: JSON.stringify(item.scoreBreakdown),
        scanned_at: scannedAt,
      });
    }
  });

  insertMany(scored);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n── Scan complete ──`);
  console.log(`${newItems.length} candidates stored in DB`);
  console.log(`Elapsed: ${elapsed}s`);
}

main().catch(err => {
  console.error(`[scan] Fatal error: ${err.message}`);
  process.exit(1);
});
