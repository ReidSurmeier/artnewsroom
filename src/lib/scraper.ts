import { chromium, type Browser } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import { addArticle, getDb } from './db';

const CHROMIUM_PATH = '/home/reidsurmeier/.local/bin/chromium';

// ── Fetch raw HTML from a URL using Playwright ──

export async function fetchArticle(url: string): Promise<string> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for dynamic content to render
    await page.waitForTimeout(2000);
    const html = await page.content();
    return html;
  } finally {
    if (browser) await browser.close();
  }
}

// ── Extract article content using Readability ──

export interface ExtractedArticle {
  title: string;
  author: string | null;
  content: string; // HTML
  excerpt: string;
}

export function extractArticle(html: string, url: string): ExtractedArticle | null {
  const doc = new JSDOM(html, { url });
  const document = doc.window.document;
  const baseUrl = new URL(url);

  // ── Pre-Readability cleanup: strip junk elements ──
  const junkSelectors = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript', 'iframe',
    'form',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
    '.sidebar', '.related-posts', '.related-articles', '.related',
    '.newsletter', '.newsletter-signup', '.signup',
    '.social-share', '.share-buttons', '.sharing',
    '.comments', '.comment-section',
    '.advertisement', '.ad', '.ads', '.ad-container',
    '.nav', '.menu', '.breadcrumb',
    '.footer', '.site-header', '.site-footer',
    '.widget', '.popup', '.modal',
  ];
  for (const selector of junkSelectors) {
    document.querySelectorAll(selector).forEach(el => el.remove());
  }

  // Strip elements with id/class matching ad, cookie, sidebar, widget patterns
  const preCleanPatterns = /\b(cookie|consent|gdpr|popup|modal|overlay|banner|alert|notification|toolbar|skip|sticky|widget|recommended|trending|popular|most-read|most_read|latest-news|latest_news|more-stories|more_stories)\b/i;
  document.querySelectorAll('*').forEach(el => {
    const cls = el.getAttribute('class') || '';
    const id = el.getAttribute('id') || '';
    if (preCleanPatterns.test(cls) || preCleanPatterns.test(id)) {
      el.remove();
    }
  });

  // Pre-Readability: promote lazy-loaded image data-src to src so Readability preserves them
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
    if ((!src || src.includes('data:image') || src.includes('placeholder') || src.includes('blank.')) && dataSrc) {
      img.setAttribute('src', dataSrc);
    }
  });

  const reader = new Readability(document.cloneNode(true) as Document);
  const article = reader.parse();

  const hostname = baseUrl.hostname.replace(/^www\./, '');
  const siteName = hostname.split('.')[0];
  const badTitles = ['404', 'not found', 'error', 'page not found', 'untitled', ''];

  function isBadTitle(t: string): boolean {
    const lower = t.toLowerCase().trim();
    return (
      t.length < 3 ||
      badTitles.includes(lower) ||
      lower === siteName.toLowerCase() ||
      lower === hostname.toLowerCase()
    );
  }

  function getBestTitle(): string {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle && !isBadTitle(ogTitle)) return ogTitle;
    const h1 = document.querySelector('h1');
    if (h1?.textContent && !isBadTitle(h1.textContent.trim())) return h1.textContent.trim();
    return 'Untitled';
  }

  function getMetaAuthor(): string | null {
    const meta =
      document.querySelector('meta[property="og:author"]')?.getAttribute('content') ||
      document.querySelector('meta[property="article:author"]')?.getAttribute('content') ||
      document.querySelector('meta[name="author"]')?.getAttribute('content');
    return meta || null;
  }

  function getLargestTextBlock(): string {
    const candidates = document.querySelectorAll('article, [role="main"], main, .post-content, .article-body, .entry-content, .story-body');
    let best = '';
    candidates.forEach((el) => {
      const text = (el as Element).textContent || '';
      if (text.length > best.length) best = text;
    });
    if (best.length < 200) {
      document.querySelectorAll('div, section').forEach((el) => {
        const text = (el as Element).textContent || '';
        if (text.length > best.length) best = text;
      });
    }
    return best.trim();
  }

  // ── Post-Readability cleanup ──
  function cleanExtractedHtml(rawHtml: string): string {
    const cleanDoc = new JSDOM(rawHtml);
    const cleanDocument = cleanDoc.window.document;

    // Remove any remaining junk elements that Readability let through
    const postCleanSelectors = [
      'nav', 'footer', 'aside', 'header',
      '[role="navigation"]', '[role="banner"]',
      '.related-posts', '.related-articles', '.related',
      '.newsletter', '.social-share', '.comments', '.advertisement', '.ad',
    ];
    for (const sel of postCleanSelectors) {
      cleanDocument.querySelectorAll(sel).forEach(el => el.remove());
    }

    // Remove elements with classes matching junk patterns
    const junkClassPatterns = /\b(tag|category|social|share|newsletter|subscribe|related|sidebar|comment|ad-|ads|promo|footer|nav|menu|breadcrumb|byline-tag)\b/i;
    cleanDocument.querySelectorAll('*').forEach(el => {
      const cls = el.getAttribute('class') || '';
      const id = el.getAttribute('id') || '';
      if (junkClassPatterns.test(cls) || junkClassPatterns.test(id)) {
        el.remove();
      }
    });

    // Remove short anchor tags that are category/tag links (not inside a paragraph of real text)
    cleanDocument.querySelectorAll('a').forEach(a => {
      const text = (a.textContent || '').trim();
      const parent = a.parentElement;
      // Short link text (likely a tag/category label) with no substantial sibling text
      if (text.length > 0 && text.length <= 30) {
        const parentText = (parent?.textContent || '').trim();
        const siblingText = parentText.replace(text, '').trim();
        // If the parent has barely any text besides this link, it's a tag link
        if (siblingText.length < 10) {
          // Remove the parent if it's a li/span/div wrapper, otherwise just the link
          if (parent && /^(li|span)$/i.test(parent.tagName)) {
            parent.remove();
          } else {
            a.remove();
          }
        }
      }
    });

    // Remove "Related:" / "More from" / "Subscribe" / "Read more" / "Sign up" sections
    cleanDocument.querySelectorAll('h2, h3, h4, p, div, section, span').forEach(el => {
      const text = (el.textContent || '').trim();
      if (/^(Related|More from|You may also like|Recommended|Read next|Also read|Read more|Subscribe|Sign up|Daily Newsletter|Weekly Newsletter|Get the latest|Join our|Don't miss)/i.test(text)) {
        // Remove this element and all following siblings (the related list)
        let sibling = el.nextElementSibling;
        while (sibling) {
          const next = sibling.nextElementSibling;
          sibling.remove();
          sibling = next;
        }
        el.remove();
      }
    });

    // Remove link-only paragraphs (paragraphs/divs containing only links, no surrounding text)
    cleanDocument.querySelectorAll('p, div').forEach(el => {
      const links = el.querySelectorAll('a');
      if (links.length === 0) return;
      // Get text content that isn't inside a link
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll('a').forEach(a => a.remove());
      const nonLinkText = (clone.textContent || '').trim();
      if (nonLinkText.length < 5) {
        el.remove();
      }
    });

    // Remove empty paragraphs and divs
    cleanDocument.querySelectorAll('p, div').forEach(el => {
      if ((el.textContent || '').trim() === '' && el.querySelectorAll('img, video, iframe, figure').length === 0) {
        el.remove();
      }
    });

    // Remove figure captions that are just photo credits
    const creditPattern = /^(Getty|AP|Reuters|Courtesy|Photo:|AFP|Alamy|Shutterstock|Photograph:|Image:|Credit:)/i;
    cleanDocument.querySelectorAll('figcaption').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text.length < 80 && creditPattern.test(text)) {
        el.remove();
      }
    });

    // Remove divs/sections that are mostly links (>50% of text is inside anchors)
    cleanDocument.querySelectorAll('div, section').forEach(el => {
      const totalText = (el.textContent || '').trim();
      if (totalText.length < 20) return; // skip tiny elements
      let linkTextLen = 0;
      el.querySelectorAll('a').forEach(a => {
        linkTextLen += (a.textContent || '').trim().length;
      });
      if (linkTextLen > totalText.length * 0.5) {
        el.remove();
      }
    });

    // Remove duplicate images (same src appearing multiple times)
    const seenSrcs = new Set<string>();
    cleanDocument.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src && seenSrcs.has(src)) {
        // Remove the duplicate img or its figure parent
        const figure = img.closest('figure');
        if (figure) {
          figure.remove();
        } else {
          img.remove();
        }
      } else if (src) {
        seenSrcs.add(src);
      }
    });

    // Fix image URLs: convert relative to absolute
    // Also check for lazy-loaded images with data-src attributes
    cleanDocument.querySelectorAll('img').forEach(img => {
      // Promote data-src / data-lazy-src to src if src is missing or a placeholder
      const src = img.getAttribute('src') || '';
      const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
      const effectiveSrc = (!src || src.includes('data:image') || src.includes('placeholder') || src.includes('blank.')) && dataSrc
        ? dataSrc : src;

      if (effectiveSrc && !effectiveSrc.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(effectiveSrc, url).href;
          img.setAttribute('src', absoluteUrl);
        } catch {
          // Leave as-is if URL parsing fails
        }
      }
      // Also fix srcset if present
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
      if (srcset) {
        const fixed = srcset.replace(/(\S+)(\s+\S+)?/g, (match, urlPart, descriptor) => {
          try {
            const abs = new URL(urlPart, url).href;
            return abs + (descriptor || '');
          } catch {
            return match;
          }
        });
        img.setAttribute('srcset', fixed);
      }
    });

    const imgCount = cleanDocument.querySelectorAll('img').length;
    console.log(`[scraper] Found ${imgCount} images in extracted content`);

    return cleanDocument.body.innerHTML;
  }

  // If Readability completely failed, use fallbacks
  if (!article || !article.content || isBadTitle(article.title || '')) {
    const title = getBestTitle();
    const author = getMetaAuthor();
    const content = article?.content || '';
    const fallbackText = content.length > 100 ? content : getLargestTextBlock();

    if (!fallbackText || fallbackText.length < 50) return null;

    const rawContent = content.length > 100 ? content : `<div>${fallbackText}</div>`;
    return {
      title,
      author: article?.byline || author,
      content: cleanExtractedHtml(rawContent),
      excerpt: fallbackText.slice(0, 200).trim(),
    };
  }

  let title = article.title || '';

  if (isBadTitle(title)) {
    title = getBestTitle();
  }

  // Strip site name suffixes from title (e.g. " | Flash Art", " - Kunstkritikk", "—Asterisk")
  title = title.replace(/\s*[\|\-\u2013\u2014]\s*[^|\-\u2013\u2014]{2,30}$/, '').trim();

  return {
    title: title || 'Untitled',
    author: article.byline || getMetaAuthor(),
    content: cleanExtractedHtml(article.content || ''),
    excerpt: (article.excerpt || article.textContent || '').slice(0, 200).trim(),
  };
}

// ── Convert HTML to Markdown ──

export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  return turndown.turndown(html);
}

// ── Sanitize text for WinAnsi encoding (pdf-lib StandardFonts) ──

function sanitizeForWinAnsi(text: string): string {
  return text
    // Smart quotes → straight quotes
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    // Dashes
    .replace(/\u2013/g, '-')  // en-dash
    .replace(/\u2014/g, '--') // em-dash
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Arrows
    .replace(/\u2190/g, '<-')
    .replace(/\u2192/g, '->')
    .replace(/\u2194/g, '<->')
    .replace(/\u2191/g, '^')
    .replace(/\u2193/g, 'v')
    // Bullets and misc
    .replace(/\u2022/g, '*')
    .replace(/\u00A0/g, ' ')  // non-breaking space
    .replace(/\uFEFF/g, '')   // BOM
    // Strip any remaining non-WinAnsi characters (keep printable ASCII + Latin-1 supplement)
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

// ── Generate a simple readable PDF from markdown ──

export async function generatePdf(markdown: string, outputPath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const fontSize = 11;
  const lineHeight = 16;
  const margin = 50;
  const pageWidth = 612; // Letter
  const pageHeight = 792;
  const maxWidth = pageWidth - margin * 2;

  // Strip markdown to plain text lines and sanitize for WinAnsi encoding
  const plainText = sanitizeForWinAnsi(markdown
    .replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/^[-*+]\s+/gm, '* ')
    .replace(/^>\s+/gm, '  ')
    .trim());

  const lines: string[] = [];
  for (const paragraph of plainText.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    // Word-wrap
    const words = paragraph.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line === '') {
      y -= lineHeight;
      continue;
    }
    try {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    } catch {
      // If encoding still fails, strip to pure ASCII
      const safeLine = line.replace(/[^\x20-\x7E]/g, '');
      page.drawText(safeLine, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, pdfBytes);
}

// ── Generate article slug ID ──

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function makeSourceSlug(source: string): string {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

// ── Full pipeline: fetch → extract → convert → store ──

export async function scrapeAndStore(
  url: string,
  source: string,
  curatorNote?: string,
): Promise<{ id: string; title: string } | null> {
  console.log(`[scraper] Fetching: ${url}`);
  const html = await fetchArticle(url);

  console.log(`[scraper] Extracting article...`);
  const extracted = extractArticle(html, url);
  if (!extracted) {
    console.error(`[scraper] Failed to extract article from ${url}`);
    return null;
  }

  console.log(`[scraper] Extracted: "${extracted.title}"`);

  const contentMarkdown = htmlToMarkdown(extracted.content);
  const today = new Date().toISOString().split('T')[0];
  const id = `${today}_${makeSourceSlug(source)}_${makeSlug(extracted.title)}`;

  // Generate PDF
  const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
  const pdfPath = `data/pdfs/${id}.pdf`;
  const pdfFullPath = path.join(process.cwd(), pdfPath);

  console.log(`[scraper] Generating PDF...`);
  const pdfContent = `${extracted.title}\n${extracted.author ? `By ${extracted.author}` : ''}\nSource: ${source}\n\n${contentMarkdown}`;
  await generatePdf(pdfContent, pdfFullPath);

  // Store in database — pass Readability HTML directly for best quality rendering
  console.log(`[scraper] Storing in database...`);
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
    content_html: extracted.content,
    excerpt: extracted.excerpt.slice(0, 200),
    pdf_path: pdfPath,
  });

  console.log(`[scraper] Done: ${id}`);
  return { id, title: extracted.title };
}
