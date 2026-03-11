#!/usr/bin/env tsx

/**
 * Enrich articles that only have metadata (no content) using Playwright + cookies.
 */

import { chromium } from 'playwright';
import { getDb } from '../lib/db';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';

const turndown = new TurndownService();
const CHROMIUM = '/home/reidsurmeier/.local/bin/chromium';
const CREDS_DIR = path.join(process.cwd(), '.credentials');

interface CookieFile {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expires: number;
}

function getCookieFile(source: string): string | null {
  const map: Record<string, string> = {
    'The New Yorker': 'cookies-newyorker.json',
    'The Atlantic': 'cookies-atlantic.json',
    'NY Mag': 'cookies-nymag.json',
    'NYT Arts': 'cookies-nyt.json',
    'NYT T Magazine': 'cookies-nyt.json',
  };
  const file = map[source];
  if (!file) return null;
  const full = path.join(CREDS_DIR, file);
  return fs.existsSync(full) ? full : null;
}

function loadCookies(file: string) {
  const raw: CookieFile[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return raw.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    secure: c.secure || false,
    httpOnly: c.httpOnly || false,
    sameSite: (c.sameSite === 'no_restriction' ? 'None' : c.sameSite || 'Lax') as 'Strict' | 'Lax' | 'None',
    expires: c.expires || -1,
  }));
}

async function main() {
  const db = getDb();

  // Find articles with no content
  const empty = db.prepare(
    "SELECT id, title, source, source_url FROM articles WHERE (content_markdown IS NULL OR content_markdown = '') ORDER BY date_added DESC"
  ).all() as { id: string; title: string; source: string; source_url: string }[];

  console.log(`Found ${empty.length} articles without content\n`);

  if (empty.length === 0) return;

  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Group by source to reuse contexts
  const bySource = new Map<string, typeof empty>();
  for (const a of empty) {
    const list = bySource.get(a.source) || [];
    list.push(a);
    bySource.set(a.source, list);
  }

  let enriched = 0;
  let skipped = 0;

  for (const [source, articles] of bySource) {
    const cookieFile = getCookieFile(source);

    // Create context with cookies if available
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    });

    if (cookieFile) {
      const cookies = loadCookies(cookieFile);
      await context.addCookies(cookies);
      console.log(`[${source}] Loaded cookies from ${path.basename(cookieFile)}`);
    } else {
      console.log(`[${source}] No cookies available, using plain fetch`);
    }

    for (const article of articles) {
      process.stdout.write(`  ${article.title.slice(0, 55)}... `);

      try {
        const page = await context.newPage();
        await page.goto(article.source_url, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.waitForTimeout(2000);

        const html = await page.content();
        await page.close();

        // Check if blocked
        if (html.includes('robot') || html.includes('blocked') || html.length < 1000) {
          console.log('❌ blocked');
          skipped++;
          continue;
        }

        // Extract with Readability
        const dom = new JSDOM(html, { url: article.source_url });
        const reader = new Readability(dom.window.document);
        const parsed = reader.parse();

        if (!parsed || !parsed.content || parsed.content.length < 200) {
          console.log('❌ no content extracted');
          skipped++;
          continue;
        }

        const markdown = turndown.turndown(parsed.content);
        const contentHtml = marked.parse(markdown) as string;
        const excerpt = parsed.excerpt || parsed.textContent?.slice(0, 300) || '';
        const author = parsed.byline || null;

        db.prepare(
          'UPDATE articles SET content_markdown = ?, content_html = ?, excerpt = ?, author = ?, search_text = ? WHERE id = ?'
        ).run(
          markdown,
          contentHtml,
          excerpt.slice(0, 300),
          author,
          `${article.title} ${author || ''} ${article.source} ${markdown}`,
          article.id
        );

        console.log(`✅ (${markdown.length} chars)`);
        enriched++;
      } catch (err) {
        console.log(`❌ ${(err as Error).message.slice(0, 50)}`);
        skipped++;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    await context.close();
  }

  await browser.close();

  console.log(`\nDone: ${enriched} enriched, ${skipped} skipped`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
