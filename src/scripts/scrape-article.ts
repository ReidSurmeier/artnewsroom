#!/usr/bin/env tsx

/**
 * CLI script to manually scrape and store a single article.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-article.ts "https://example.com/article" "Source Name" ["Optional curator note"]
 */

import { scrapeAndStore, fetchArticle, extractArticle, htmlToMarkdown } from '../lib/scraper';
import { isPaywalled, fetchPaywalledArticle } from '../lib/paywall';
import { addArticle, getDb } from '../lib/db';
import { marked } from 'marked';
import { generatePdf } from '../lib/scraper';
import path from 'path';

async function main() {
  const [, , url, source, curatorNote] = process.argv;

  if (!url || !source) {
    console.error('Usage: npx tsx src/scripts/scrape-article.ts <url> <source> [curator_note]');
    console.error('Example: npx tsx src/scripts/scrape-article.ts "https://example.com/article" "Spike Art Magazine"');
    process.exit(1);
  }

  console.log(`\n── Scraping article ──`);
  console.log(`URL:    ${url}`);
  console.log(`Source: ${source}`);
  if (curatorNote) console.log(`Note:   ${curatorNote}`);
  console.log('');

  try {
    // Use paywalled fetch if needed
    let html: string;
    if (isPaywalled(source)) {
      console.log(`[scrape] Source is paywalled, using login flow...`);
      html = await fetchPaywalledArticle(url, source);
    } else {
      html = await fetchArticle(url);
    }

    const extracted = extractArticle(html, url);
    if (!extracted) {
      console.error('[scrape] Failed to extract article content');
      process.exit(1);
    }

    console.log(`[scrape] Title:   ${extracted.title}`);
    console.log(`[scrape] Author:  ${extracted.author || 'Unknown'}`);
    console.log(`[scrape] Excerpt: ${extracted.excerpt.slice(0, 100)}...`);

    const contentMarkdown = htmlToMarkdown(extracted.content);
    const today = new Date().toISOString().split('T')[0];

    const slug = extracted.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .replace(/-+$/, '');
    const sourceSlug = source
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    const id = `${today}_${sourceSlug}_${slug}`;

    // Generate PDF
    const pdfPath = `data/pdfs/${id}.pdf`;
    const pdfFullPath = path.join(process.cwd(), pdfPath);
    const pdfContent = `${extracted.title}\n${extracted.author ? `By ${extracted.author}` : ''}\nSource: ${source}\n\n${contentMarkdown}`;
    await generatePdf(pdfContent, pdfFullPath);

    // Store
    addArticle({
      id,
      title: extracted.title,
      author: extracted.author || undefined,
      source,
      source_url: url,
      date_published: today,
      date_added: today,
      curator_note: curatorNote,
      content_markdown: contentMarkdown,
      excerpt: extracted.excerpt.slice(0, 200),
      pdf_path: pdfPath,
    });

    console.log(`\n── Done ──`);
    console.log(`ID:  ${id}`);
    console.log(`PDF: ${pdfPath}`);
  } catch (err) {
    const error = err as Error;
    console.error(`\n── Scraping failed ──`);
    console.error(`URL:     ${url}`);
    console.error(`Source:  ${source}`);
    console.error(`Error:   ${error.message}`);
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.error(`\nHint: The page took too long to load. Try again or check if the URL is accessible.`);
    } else if (error.message.includes('net::ERR_') || error.message.includes('ENOTFOUND')) {
      console.error(`\nHint: Could not reach the URL. Check your internet connection or verify the URL is correct.`);
    } else if (error.message.includes('extract')) {
      console.error(`\nHint: The page loaded but article content could not be extracted. The site may use a format that isn't supported.`);
    }
    if (process.env.DEBUG) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

main();
