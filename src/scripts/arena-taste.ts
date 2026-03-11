#!/usr/bin/env tsx

/**
 * Are.na Taste Profiler
 *
 * Pulls blocks from the user's Are.na channels, extracts sources/titles/descriptions,
 * and builds a taste profile (top domains, recurring themes, keywords, authors).
 *
 * Channels:
 *   - Articles/Essays: https://www.are.na/reid-surmeier/articles-essays-bwxdzvfcypq
 *   - Philosophy: https://www.are.na/reid-surmeier/philosophy-y7ecpgsohi0
 *
 * Output: data/taste-profile.json
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.are.na/v2';
const CHANNELS = [
  { slug: 'articles-essays-bwxdzvfcypq', label: 'Articles/Essays' },
  { slug: 'philosophy-y7ecpgsohi0', label: 'Philosophy' },
];
const PER_PAGE = 100;

interface ArenaBlock {
  id: number;
  title: string;
  description: string | null;
  description_html: string | null;
  content: string | null;
  content_html: string | null;
  generated_title: string | null;
  class: string; // 'Link', 'Text', 'Image', 'Media', 'Attachment'
  source: { url: string; title?: string; provider_name?: string } | null;
  created_at: string;
  updated_at: string;
  connected_at?: string;
}

interface TasteBlock {
  title: string;
  url: string | null;
  domain: string | null;
  description: string | null;
  channel: string;
  type: string;
  date: string;
}

interface TasteProfile {
  generated_at: string;
  total_blocks: number;
  channels: { label: string; slug: string; count: number }[];
  blocks: TasteBlock[];
  domains: { domain: string; count: number }[];
  sources: { source: string; count: number }[];
  keywords: { keyword: string; count: number }[];
  block_types: Record<string, number>;
}

async function fetchChannel(slug: string): Promise<ArenaBlock[]> {
  // First get total length from channel metadata
  const metaRes = await fetch(`${API_BASE}/channels/${slug}?per=0`);
  if (!metaRes.ok) throw new Error(`Are.na API error: ${metaRes.status}`);
  const meta = await metaRes.json();
  const totalBlocks = meta.length || 0;
  const totalPages = Math.ceil(totalBlocks / PER_PAGE);
  console.log(`  ${totalBlocks} blocks, ${totalPages} pages`);

  const blocks: ArenaBlock[] = [];
  for (let page = 1; page <= totalPages; page++) {
    const url = `${API_BASE}/channels/${slug}/contents?per=${PER_PAGE}&page=${page}`;
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url);
      if (res.ok) break;
      console.warn(`  Page ${page} attempt ${attempt + 1} failed (${res.status}), retrying...`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
    if (!res || !res.ok) {
      console.warn(`  Skipping page ${page} after 3 attempts`);
      continue;
    }
    const data = await res.json();
    const contents = data.contents || data;
    if (Array.isArray(contents)) {
      blocks.push(...contents);
      console.log(`  Page ${page}/${totalPages}: +${contents.length} blocks`);
    }
    // Be nice to the API
    await new Promise(r => setTimeout(r, 800));
  }

  return blocks;
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction: split, lowercase, filter stopwords, count
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'that', 'this', 'was', 'are',
    'be', 'has', 'had', 'have', 'not', 'as', 'its', 'his', 'her', 'their',
    'our', 'we', 'you', 'they', 'he', 'she', 'who', 'what', 'how', 'when',
    'where', 'which', 'more', 'about', 'into', 'over', 'after', 'than',
    'between', 'through', 'can', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'up', 'out', 'all', 'no', 'so',
    'if', 'just', 'one', 'also', 'like', 'new', 'very', 'been', 'being',
    'other', 'some', 'most', 'then', 'now', 'even', 'only', 'much', 'such',
    'these', 'those', 'each', 'every', 'any', 'own', 'same', 'while',
    'both', 'few', 'many', 'way', 'make', 'made', 'first', 'two',
    '', 'amp', 'nbsp', '—', '–', '"', '"',
  ]);

  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '') // strip HTML
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
}

async function main() {
  console.log('── Are.na Taste Profiler ──\n');

  const allBlocks: TasteBlock[] = [];
  const channelStats: { label: string; slug: string; count: number }[] = [];

  for (const channel of CHANNELS) {
    console.log(`Fetching: ${channel.label} (${channel.slug})`);
    const raw = await fetchChannel(channel.slug);
    console.log(`  Got ${raw.length} blocks\n`);

    channelStats.push({ label: channel.label, slug: channel.slug, count: raw.length });

    for (const block of raw) {
      const url = block.source?.url || null;
      allBlocks.push({
        title: block.generated_title || block.title || '',
        url,
        domain: url ? extractDomain(url) : null,
        description: block.description || null,
        channel: channel.label,
        type: block.class || 'Unknown',
        date: block.connected_at || block.created_at,
      });
    }
  }

  // --- Analyze ---

  // Domain frequency
  const domainCounts = new Map<string, number>();
  for (const b of allBlocks) {
    if (b.domain) {
      domainCounts.set(b.domain, (domainCounts.get(b.domain) || 0) + 1);
    }
  }
  const domains = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));

  // Source name frequency (from titles — extract publication after "|" or "—")
  const sourceCounts = new Map<string, number>();
  for (const b of allBlocks) {
    const match = b.title.match(/[|—–]\s*(.+)$/);
    if (match) {
      const src = match[1].trim();
      if (src.length > 2 && src.length < 80) {
        sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
      }
    }
  }
  const sources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));

  // Keyword frequency
  const kwCounts = new Map<string, number>();
  for (const b of allBlocks) {
    const text = `${b.title} ${b.description || ''}`;
    const kws = extractKeywords(text);
    for (const kw of kws) {
      kwCounts.set(kw, (kwCounts.get(kw) || 0) + 1);
    }
  }
  const keywords = [...kwCounts.entries()]
    .filter(([_, count]) => count >= 3) // at least 3 occurrences
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([keyword, count]) => ({ keyword, count }));

  // Block type breakdown
  const blockTypes: Record<string, number> = {};
  for (const b of allBlocks) {
    blockTypes[b.type] = (blockTypes[b.type] || 0) + 1;
  }

  // --- Build profile ---
  const profile: TasteProfile = {
    generated_at: new Date().toISOString(),
    total_blocks: allBlocks.length,
    channels: channelStats,
    blocks: allBlocks,
    domains,
    sources,
    keywords,
    block_types: blockTypes,
  };

  // Write output
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'taste-profile.json');
  fs.writeFileSync(outPath, JSON.stringify(profile, null, 2));

  // --- Print summary ---
  console.log('── Taste Profile Summary ──\n');
  console.log(`Total blocks: ${allBlocks.length}`);
  console.log(`Block types: ${JSON.stringify(blockTypes)}`);
  console.log(`\nTop 15 domains:`);
  for (const d of domains.slice(0, 15)) {
    console.log(`  ${d.count.toString().padStart(3)} × ${d.domain}`);
  }
  console.log(`\nTop 15 sources (from titles):`);
  for (const s of sources.slice(0, 15)) {
    console.log(`  ${s.count.toString().padStart(3)} × ${s.source}`);
  }
  console.log(`\nTop 30 keywords:`);
  console.log(`  ${keywords.slice(0, 30).map(k => `${k.keyword}(${k.count})`).join(', ')}`);

  console.log(`\nProfile saved to: ${outPath}`);
}

main().catch(err => {
  console.error(`[arena] Fatal: ${err.message}`);
  process.exit(1);
});
