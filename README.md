# NEWSROOM

A curated reading room for art, culture, and criticism.

[newsroom.reidsurmeier.wtf](https://newsroom.reidsurmeier.wtf)

## Stack

- **Next.js 16** (App Router, standalone output)
- **SQLite** via better-sqlite3 — articles, images, annotations, drawings
- **sharp** — image processing (B&W conversion, resize)
- **Braille Unicode** — ASCII art rendering from images (2×4 dot grid per character)
- **Readability + Turndown** — content extraction → markdown
- **Cloudflare Tunnel** — HTTPS to self-hosted server
- **systemd** — process management

## How It Works

### Content Pipeline

1. **RSS scan** — pulls from ~40 sources across tiers (publications, substacks, independent blogs)
2. **Taste scoring** — ranks candidates against a personal taste profile (domain affinity, keyword overlap, source matching, recency)
3. **Diversity filter** — max 3 articles per source per batch, prevents any publication from dominating
4. **Content extraction** — Mozilla Readability parses full article text, Turndown converts to markdown
5. **Image processing** — extracts images from articles, converts to B&W, generates Braille-based ASCII art
6. **Quality gate** — only long-form pieces (10k+ chars) surface as top picks

### Sources

Tier 1 through 4, spanning: The New Yorker, n+1, Asterisk, Pioneer Works, Henrik Karlsson, Arachne, Public Domain Review, Hyperallergic, Dazed, Artforum, Cultured, Momus, The Creative Independent, The Drift, Fakewhale, Flash Art, Kunstkritikk, and others.

Full source list in `src/lib/rss.ts`.

### Reader Features

- Braille ASCII art images inline with article text
- Article annotations and highlights
- Drawing overlay (freehand on articles)
- Focus mode (distraction-free reading)
- Notes panel per article
- Archive system
- Writer tracking

## Development

```bash
npm install
npm run dev
```

## Scripts

```bash
npx tsx src/scripts/daily-scan.ts          # Scan RSS feeds for new candidates
npx tsx src/scripts/promote-candidates.ts   # Promote top candidates to articles (max 3/source)
npx tsx src/scripts/process-images.ts <id>  # Process images for a single article
npx tsx src/scripts/reprocess-all-images.ts # Reprocess all article images
```

## Deploy

```bash
./scripts/deploy.sh
```
