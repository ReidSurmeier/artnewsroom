/**
 * Process images for a single article:
 * - Extract image URLs from content
 * - Download each image
 * - Convert to ASCII art
 * - Convert to B&W
 * - Store in article_images table
 *
 * Usage: npx tsx src/scripts/process-images.ts <article-id>
 */

import path from 'path';
import fs from 'fs';
import { getDb, getArticle, clearArticleImages, insertArticleImage } from '../lib/db';
import sharp from 'sharp';

const BW_DIR = path.join(process.cwd(), 'data', 'images', 'bw');

/**
 * Braille-based image rendering.
 * Each braille character is a 2×4 dot grid, so one character = 2px wide × 4px tall.
 * This gives 8x the effective resolution of traditional ASCII art.
 *
 * Braille Unicode block: U+2800 to U+28FF
 * Dot positions:
 *   [0] [3]
 *   [1] [4]
 *   [2] [5]
 *   [6] [7]
 *
 * Each dot maps to a bit: dot N → bit N
 */

// Braille dot bit positions (row, col) → bit index
const BRAILLE_BASE = 0x2800;
const DOT_BITS = [
  [0, 0, 0x01], // row 0, col 0 → bit 0
  [1, 0, 0x02], // row 1, col 0 → bit 1
  [2, 0, 0x04], // row 2, col 0 → bit 2
  [0, 1, 0x08], // row 0, col 1 → bit 3
  [1, 1, 0x10], // row 1, col 1 → bit 4
  [2, 1, 0x20], // row 2, col 1 → bit 5
  [3, 0, 0x40], // row 3, col 0 → bit 6
  [3, 1, 0x80], // row 3, col 1 → bit 7
];

// Dithering threshold map (4x4 Bayer matrix, tiled to 2x4 braille cells)
const BAYER_4x4 = [
  [ 0, 8, 2, 10],
  [12, 4, 14,  6],
  [ 3, 11, 1,  9],
  [15, 7, 13,  5],
];

async function imageToAscii(buffer: Buffer, width = 140): Promise<string> {
  const img = sharp(buffer);
  const metadata = await img.metadata();
  if (!metadata.width || !metadata.height) return '[image]';

  const aspectRatio = metadata.height / metadata.width;

  // Each braille char covers 2px wide × 4px tall
  // So pixel width = charWidth * 2, pixel height = charHeight * 4
  const pixelWidth = width * 2;
  const pixelHeight = Math.round(pixelWidth * aspectRatio);
  // Round height up to multiple of 4
  const adjHeight = Math.ceil(pixelHeight / 4) * 4;
  const charHeight = adjHeight / 4;

  // Apply contrast enhancement + slight sharpen for better detail
  const raw = await img
    .grayscale()
    .sharpen({ sigma: 0.8 })
    .normalize() // auto contrast stretch
    .resize(pixelWidth, adjHeight, { fit: 'fill' })
    .raw()
    .toBuffer();

  let result = '';

  for (let cy = 0; cy < charHeight; cy++) {
    for (let cx = 0; cx < width; cx++) {
      let bits = 0;

      for (const [dr, dc, bit] of DOT_BITS) {
        const py = cy * 4 + dr;
        const px = cx * 2 + dc;
        const idx = py * pixelWidth + px;
        const brightness = raw[idx] ?? 0;

        // Ordered dithering using Bayer matrix for better tonal range
        const bayerRow = py % 4;
        const bayerCol = px % 4;
        const threshold = ((BAYER_4x4[bayerRow][bayerCol] + 0.5) / 16) * 255;

        // Dot is ON when pixel is darker than threshold (dark = filled)
        if (brightness < threshold) {
          bits |= bit;
        }
      }

      result += String.fromCharCode(BRAILLE_BASE + bits);
    }
    result += '\n';
  }

  return result;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArtNewsroom/1.0)' },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function extractImageUrls(html: string): { url: string; alt: string }[] {
  const results: { url: string; alt: string }[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
    results.push({
      url: match[1],
      alt: altMatch ? altMatch[1] : '',
    });
  }
  return results;
}

export async function processArticleImages(articleId: string) {
  // Initialize DB
  getDb();
  const article = getArticle(articleId) as { id: string; content_html: string; content_markdown: string } | undefined;
  if (!article) {
    console.error(`Article not found: ${articleId}`);
    return;
  }

  const html = article.content_html || '';
  const images = extractImageUrls(html);

  if (images.length === 0) {
    console.log(`No images found in article: ${articleId}`);
    return;
  }

  console.log(`Found ${images.length} images in article: ${articleId}`);

  // Clear existing
  clearArticleImages(articleId);

  if (!fs.existsSync(BW_DIR)) fs.mkdirSync(BW_DIR, { recursive: true });

  for (let i = 0; i < images.length; i++) {
    const { url, alt } = images[i];
    console.log(`  Processing image ${i + 1}/${images.length}: ${url.slice(0, 80)}...`);

    const buffer = await downloadImage(url);
    if (!buffer) {
      console.log(`    Failed to download, skipping`);
      continue;
    }

    try {
      // Generate ASCII art
      const asciiArt = await imageToAscii(buffer);

      // Generate B&W version
      const bwFilename = `${articleId.replace(/[^a-z0-9_-]/gi, '_')}_${i}.jpg`;
      const bwPath = path.join(BW_DIR, bwFilename);
      await sharp(buffer)
        .grayscale()
        .jpeg({ quality: 80 })
        .toFile(bwPath);

      insertArticleImage({
        article_id: articleId,
        original_url: url,
        ascii_art: asciiArt,
        bw_image_path: `/api/images/bw/${bwFilename}`,
        alt_text: alt,
        position: i,
      });

      console.log(`    Done`);
    } catch (e) {
      console.log(`    Error processing: ${e}`);
    }
  }

  console.log(`Finished processing images for: ${articleId}`);
}

// CLI entry
const articleId = process.argv[2];
if (articleId) {
  processArticleImages(articleId).catch(console.error);
} else {
  console.log('Usage: npx tsx src/scripts/process-images.ts <article-id>');
}
