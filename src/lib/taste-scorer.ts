/**
 * Taste Scorer
 *
 * Scores RSS candidate articles against the user's Are.na taste profile.
 * Higher score = better match to reading interests.
 *
 * Scoring factors:
 *   - Domain affinity (source appears in Are.na bookmarks)
 *   - Keyword overlap (title/description matches recurring themes)
 *   - Source name match (publication appears in saved articles)
 *   - Tier bonus (higher-tier sources get a small boost)
 */

import fs from 'fs';
import path from 'path';
import type { FeedItem } from './rss';

interface TasteProfile {
  domains: { domain: string; count: number }[];
  sources: { source: string; count: number }[];
  keywords: { keyword: string; count: number }[];
}

let _profile: TasteProfile | null = null;
let _domainMap: Map<string, number> | null = null;
let _sourceMap: Map<string, number> | null = null;
let _keywordMap: Map<string, number> | null = null;

function loadProfile(): TasteProfile {
  if (_profile) return _profile;

  const profilePath = path.join(process.cwd(), 'data', 'taste-profile.json');
  if (!fs.existsSync(profilePath)) {
    console.warn('[scorer] No taste profile found at data/taste-profile.json — scoring disabled');
    _profile = { domains: [], sources: [], keywords: [] };
    return _profile;
  }

  _profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as TasteProfile;

  // Build lookup maps
  _domainMap = new Map(_profile.domains.map(d => [d.domain, d.count]));
  _sourceMap = new Map(_profile.sources.map(s => [s.source.toLowerCase(), s.count]));
  _keywordMap = new Map(_profile.keywords.map(k => [k.keyword, k.count]));

  return _profile;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
}

export interface ScoredItem extends FeedItem {
  score: number;
  scoreBreakdown: {
    domain: number;
    keywords: number;
    source: number;
    recency: number;
  };
}

/**
 * Score a single feed item against the taste profile.
 * Returns a score from 0-100.
 */
export function scoreItem(item: FeedItem): ScoredItem {
  loadProfile();

  let domainScore = 0;
  let keywordScore = 0;
  let sourceScore = 0;
  let recencyScore = 0;

  // 1. Domain affinity (0-30 points)
  const domain = extractDomain(item.url);
  if (domain && _domainMap) {
    const count = _domainMap.get(domain) || 0;
    if (count > 0) {
      // Log scale: 1 save = 10pts, 5+ saves = 20pts, 10+ = 30pts
      domainScore = Math.min(30, Math.round(10 * Math.log2(count + 1)));
    }
  }

  // 2. Keyword overlap (0-40 points)
  if (_keywordMap) {
    const tokens = tokenize(item.title);
    let kwHits = 0;
    let kwWeight = 0;
    for (const token of tokens) {
      const count = _keywordMap.get(token);
      if (count) {
        kwHits++;
        kwWeight += Math.log2(count + 1);
      }
    }
    if (tokens.length > 0) {
      // Ratio of matching keywords × their weight
      const hitRatio = kwHits / tokens.length;
      keywordScore = Math.min(40, Math.round(hitRatio * kwWeight * 8));
    }
  }

  // 3. Source name match (0-20 points)
  if (_sourceMap) {
    // Check if the RSS source name appears in the taste profile sources
    const srcLower = item.source.toLowerCase();
    for (const [profileSrc, count] of _sourceMap) {
      if (srcLower.includes(profileSrc) || profileSrc.includes(srcLower)) {
        sourceScore = Math.min(20, Math.round(5 * Math.log2(count + 1)));
        break;
      }
    }
  }

  // 4. Recency bonus (0-10 points)
  const ageMs = Date.now() - new Date(item.date).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 1) recencyScore = 10;
  else if (ageDays < 3) recencyScore = 7;
  else if (ageDays < 7) recencyScore = 4;
  else if (ageDays < 14) recencyScore = 2;

  // 5. Indie/Substack boost — small publishers get a floor score so they
  //    aren't drowned out by NYT/New Yorker domain-affinity dominance.
  //    Tier 3 (indie blogs/substacks) +20, Tier 2 +10, Tier 4 +5.
  let indieBoost = 0;
  const { SOURCES } = require('./rss');
  const matchedSource = SOURCES.find((s: any) =>
    s.name.toLowerCase() === item.source.toLowerCase()
  );
  if (matchedSource) {
    if (matchedSource.tier === 3) indieBoost = 20;
    else if (matchedSource.tier === 2) indieBoost = 10;
    else if (matchedSource.tier === 4) indieBoost = 5;
  }

  const score = domainScore + keywordScore + sourceScore + recencyScore + indieBoost;

  return {
    ...item,
    score: Math.min(100, score),
    scoreBreakdown: {
      domain: domainScore,
      keywords: keywordScore,
      source: sourceScore,
      recency: recencyScore,
    },
  };
}

/**
 * Score and rank a batch of feed items.
 * Returns items sorted by score descending.
 */
export function rankItems(items: FeedItem[]): ScoredItem[] {
  return items
    .map(scoreItem)
    .sort((a, b) => b.score - a.score);
}
