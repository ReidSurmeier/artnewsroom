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

  // Store candidates in a simple candidates table for later AI curation
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    )
  `);

  const insertCandidate = db.prepare(`
    INSERT OR IGNORE INTO candidates (url, title, source, date, scanned_at)
    VALUES (@url, @title, @source, @date, @scanned_at)
  `);

  const scannedAt = new Date().toISOString();
  const insertMany = db.transaction((items: FeedItem[]) => {
    for (const item of items) {
      insertCandidate.run({
        url: item.url,
        title: item.title,
        source: item.source,
        date: item.date,
        scanned_at: scannedAt,
      });
    }
  });

  insertMany(newItems);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n── Scan complete ──`);
  console.log(`${newItems.length} candidates stored in DB`);
  console.log(`Elapsed: ${elapsed}s`);
}

main().catch(err => {
  console.error(`[scan] Fatal error: ${err.message}`);
  process.exit(1);
});
