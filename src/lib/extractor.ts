/**
 * Article content extractor.
 *
 * Multiple strategies:
 * 1. Plain fetch + Readability (with style stripping for JSDOM compatibility)
 * 2. Playwright + cookies (for sites needing auth)
 * 3. RSS content (fallback — excerpt only)
 *
 * The style-strip trick fixes JSDOM crashes on sites like New Yorker
 * whose CSS variables cause cssstyle to throw.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

const turndown = new TurndownService();

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface ExtractedArticle {
  title: string;
  author: string | null;
  content_html: string;
  content_markdown: string;
  excerpt: string;
}

/**
 * Strip <style> tags to prevent JSDOM/cssstyle crashes on CSS variables.
 */
function stripStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

/**
 * Strip <script> tags for cleaner parsing.
 */
function stripScripts(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
}

/**
 * Extract article content from a URL using fetch + Readability.
 * Returns null if extraction fails.
 */
export async function extractArticle(url: string): Promise<ExtractedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!res.ok) return null;

    let html = await res.text();
    if (html.length < 1000) return null;

    // Strip style and script tags for JSDOM compatibility
    html = stripStyles(stripScripts(html));

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.content || article.content.length < 200) return null;

    const markdown = turndown.turndown(article.content);

    return {
      title: article.title || '',
      author: article.byline || null,
      content_html: article.content,
      content_markdown: markdown,
      excerpt: (article.excerpt || article.textContent?.slice(0, 300) || '').slice(0, 300),
    };
  } catch {
    return null;
  }
}
