import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'ArtNewsroom/1.0',
  },
});

// ── Source definitions with RSS feed URLs ──

export interface Source {
  name: string;
  url: string;
  rss?: string; // undefined = browser-only (no RSS)
  tier: 1 | 2 | 3 | 4;
}

export const SOURCES: Source[] = [
  // Tier 1
  { name: 'Spike Art Magazine', url: 'https://www.spikeartmagazine.com', tier: 1 }, // browser-only (no RSS since Next.js migration)
  { name: 'The New Yorker', url: 'https://www.newyorker.com', rss: 'https://www.newyorker.com/feed/culture', tier: 1 },
  { name: 'NYT Arts', url: 'https://www.nytimes.com', rss: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml', tier: 1 },
  { name: 'NYT T Magazine', url: 'https://www.nytimes.com', rss: 'https://rss.nytimes.com/services/xml/rss/nyt/tmagazine.xml', tier: 1 },
  { name: 'Cultured', url: 'https://www.culturedmag.com', rss: 'https://www.culturedmag.com/feed', tier: 1 },
  { name: 'Arachne', url: 'https://arachnemag.substack.com', rss: 'https://arachnemag.substack.com/feed', tier: 1 },
  { name: 'Dazed', url: 'https://www.dazeddigital.com', rss: 'https://www.dazeddigital.com/rss', tier: 1 },
  { name: 'Hacker News', url: 'https://news.ycombinator.com', rss: 'https://news.ycombinator.com/rss', tier: 1 },
  { name: "Harper's Magazine", url: 'https://harpers.org', rss: 'https://harpers.org/feed/', tier: 1 },
  { name: 'Yale Review', url: 'https://yalereview.org', tier: 1 }, // browser-only (feed returns HTML)
  { name: 'The Creative Independent', url: 'https://thecreativeindependent.com', rss: 'https://thecreativeindependent.com/feed.xml', tier: 1 },
  { name: 'Artforum', url: 'https://www.artforum.com', rss: 'https://www.artforum.com/rss', tier: 1 },
  { name: 'n+1', url: 'https://www.nplusonemag.com', rss: 'https://www.nplusonemag.com/feed/', tier: 1 },
  { name: 'Brooklyn Rail', url: 'https://brooklynrail.org', tier: 1 }, // browser-only (Directus CMS, no RSS feed)
  { name: 'Artnet News', url: 'https://news.artnet.com', rss: 'https://news.artnet.com/feed', tier: 1 },
  { name: 'Gagosian Quarterly', url: 'https://gagosian.com', tier: 1 }, // browser-only
  { name: 'Ares Luna', url: 'https://aresluna.org', tier: 1 }, // browser-only
  { name: 'Hyperallergic', url: 'https://hyperallergic.com', rss: 'https://hyperallergic.com/feed/', tier: 1 },
  { name: 'The Intrinsic Perspective', url: 'https://theintrinsicperspective.com', rss: 'https://www.theintrinsicperspective.com/feed', tier: 1 },
  { name: 'Henrik Karlsson', url: 'https://henrikkarlsson.xyz', rss: 'https://www.henrikkarlsson.xyz/feed', tier: 1 },
  { name: 'Asterisk', url: 'https://asteriskmag.com', rss: 'https://asteriskmag.com/feed', tier: 1 },

  // Tier 2
  { name: 'New Models', url: 'https://newmodels.io', tier: 2 }, // browser-only
  { name: 'Fakewhale', url: 'https://log.fakewhale.xyz', rss: 'https://log.fakewhale.xyz/feed', tier: 2 },
  { name: 'Public Domain Review', url: 'https://publicdomainreview.org', rss: 'https://publicdomainreview.org/rss.xml', tier: 2 },
  { name: 'Flash Art', url: 'https://flash---art.com', rss: 'https://flash---art.com/feed/', tier: 2 },
  { name: 'Kunstkritikk', url: 'https://kunstkritikk.com', rss: 'https://kunstkritikk.com/feed/', tier: 2 },
  { name: 'Sternberg Press', url: 'https://www.sternberg-press.com', tier: 2 }, // browser-only
  { name: 'Pioneer Works', url: 'https://pioneerworks.org', rss: 'https://pioneerworks.org/feed.xml', tier: 2 },
  { name: 'The Drift', url: 'https://www.thedriftmag.com', rss: 'https://www.thedriftmag.com/feed/', tier: 2 },
  { name: 'Right Click Save', url: 'https://rightclicksave.com', tier: 2 }, // browser-only
  { name: 'Syntax', url: 'https://syntaxmag.online', tier: 2 }, // browser-only

  // Tier 3 — Independent blogs/substacks
  { name: 'Piper Haywood', url: 'https://piperhaywood.com', rss: 'https://piperhaywood.com/feed/', tier: 3 },
  { name: 'Tom Critchlow', url: 'https://tomcritchlow.com', rss: 'https://tomcritchlow.com/feed.xml', tier: 3 },
  { name: 'Joe Carlsmith', url: 'https://joecarlsmith.com', rss: 'https://joecarlsmith.com/rss.xml', tier: 3 },
  { name: 'Donald Boat', url: 'https://donaldboat.substack.com', rss: 'https://donaldboat.substack.com/feed', tier: 3 },
  { name: 'Laurel Schwulst', url: 'https://laurelschwulst.com', tier: 3 }, // browser-only

  // Tier 4
  { name: 'e-flux', url: 'https://www.e-flux.com', tier: 4 }, // browser-only
  { name: 'Frieze', url: 'https://www.frieze.com', tier: 4 }, // browser-only
  { name: 'Art in America', url: 'https://www.artinamericamagazine.com', rss: 'https://www.artinamericamagazine.com/feed/', tier: 4 },
  { name: 'Rhizome', url: 'https://rhizome.org', tier: 4 }, // browser-only
  { name: 'Momus', url: 'https://momus.ca', rss: 'https://momus.ca/feed/', tier: 4 },
];

// ── Feed item ──

export interface FeedItem {
  title: string;
  url: string;
  source: string;
  date: string; // ISO date string
}

// ── Scan all RSS feeds ──

export async function scanFeeds(): Promise<FeedItem[]> {
  const rssSources = SOURCES.filter(s => s.rss);
  const browserOnlySources = SOURCES.filter(s => !s.rss);

  if (browserOnlySources.length > 0) {
    console.log(`[rss] Browser-only sources (no RSS): ${browserOnlySources.map(s => s.name).join(', ')}`);
  }

  console.log(`[rss] Scanning ${rssSources.length} RSS feeds...`);

  const results = await Promise.allSettled(
    rssSources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.rss!);
        const items: FeedItem[] = (feed.items || []).map(item => {
          let url = item.link || '';
          // Fix feeds that emit localhost URLs (e.g. Pioneer Works)
          if (url.startsWith('http://localhost')) {
            url = url.replace(/^http:\/\/localhost:\d+/, source.url);
          }
          return {
            title: item.title || 'Untitled',
            url,
            source: source.name,
            date: item.isoDate || item.pubDate || new Date().toISOString(),
          };
        }).filter(item => item.url);
        return items;
      } catch (err) {
        console.warn(`[rss] Failed to fetch ${source.name}: ${(err as Error).message}`);
        return [] as FeedItem[];
      }
    })
  );

  const allItems: FeedItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  // Sort by date descending
  allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  console.log(`[rss] Found ${allItems.length} total items across all feeds`);
  return allItems;
}
