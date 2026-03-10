# ART NEWSROOM — Build Brief

## What We're Building
A personal newsroom web app for curated long-form art & culture reading. The UI is modeled after sound.reidsurmeier.wtf (same fonts, same sidebar pattern, same border styles) but adapted for articles instead of music.

## Reference Site
The sound site (sound.reidsurmeier.wtf) uses:
- Font: AUTHENTICSans-Condensed-90 (in public/fonts/)
- Fixed left sidebar (248px wide, border-right: 1px solid #222)
- Title bar at top (30px height, fixed, border-bottom: 1px solid #222)
- Body overflow: hidden
- Sidebar items: font-size 0.8rem, line-height 1.5, padding 5px 0 0 4px, border-bottom 1px solid #222
- Everything is clean, minimal, monochrome (black borders, white background)

## Layout Structure
```
┌──────────────────────────────────────────────────────────────────┐
│  TITLE BAR — fixed top, full width, 30px high                    │
│  "NEWSROOM"    [search box]                                       │
├──────────┬───────────────────────────────────────────────────────┤
│ SIDEBAR  │  CONTENT AREA                                          │
│ 248px    │                                                        │
│ fixed    │  DEFAULT: Reverse-chronological article feed           │
│ left     │  - Title, source, date, excerpt                       │
│          │  - Unread = normal, Read = greyed out                  │
│ Articles │                                                        │
│ listed:  │  ARTICLE VIEW (when clicked):                         │
│ Title    │  - Curator note at top (how it was found)             │
│ Source   │  - Title, author, source, date                        │
│          │  - Extracted article text (rendered markdown/HTML)     │
│          │  - Notes panel (markdown, editable)                   │
│          │  - "Download PDF" button                              │
│          │  - Collapsible "References" section                   │
│          │                                                        │
└──────────┴───────────────────────────────────────────────────────┘
```

## Exact CSS Values to Match (from sound site)
- Title bar: fixed, top:0, padding: 4px 8px, border-bottom: 1px solid #222, background: white, z-index: 1
- Sidebar: width 248px, position fixed, height calc(100vh - 30px), margin-top: 30px, border-right: 1px solid #222, overflow-y: scroll, left: 0, top: 0, z-index: 2, scrollbar-width: none
- Sidebar items: font-size 0.8rem, line-height 1.5, list-style none, padding 5px 0 0 4px, border-bottom: 1px solid #222, cursor: pointer
- Content area: margin-left 248px, margin-top 30px, height calc(100vh - 30px), overflow-y: auto
- Font: "AUTHENTICSans-Condensed-90" (in public/fonts/), fallback to sans-serif
- body: overflow hidden, margin 0
- All borders: 1px solid #222 (no dotted borders in sidebar, only solid)

## Tech Stack
- **Next.js 16+ with App Router** (TypeScript)
- **SQLite via better-sqlite3** for article data, read state, notes, references
- **MiniSearch** for client-side full-text search
- **No Tailwind** — use plain CSS matching the sound site's style (globals.css)
- Fonts in public/fonts/ (already present)

## Database Schema (SQLite)
File: `data/newsroom.db`

```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,                    -- slug: YYYY-MM-DD_source_title-slug
  title TEXT NOT NULL,
  author TEXT,
  source TEXT NOT NULL,                   -- e.g. "Spike Art Magazine"
  source_url TEXT NOT NULL,               -- original article URL
  date_published TEXT,                    -- ISO date of article publication
  date_added TEXT NOT NULL,               -- ISO date when we added it
  curator_note TEXT,                      -- how/why this was selected
  content_markdown TEXT,                  -- extracted article text as markdown
  content_html TEXT,                      -- rendered HTML of the article
  excerpt TEXT,                           -- first ~200 chars for feed view
  pdf_path TEXT,                          -- relative path to PDF file
  is_read INTEGER DEFAULT 0,             -- 0=unread, 1=read
  notes TEXT DEFAULT '',                  -- user's markdown notes
  search_text TEXT                        -- concatenated searchable text
);

CREATE TABLE references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  title TEXT,
  found_in_article_id TEXT,              -- which article this was found in (nullable)
  date_added TEXT NOT NULL,
  FOREIGN KEY (found_in_article_id) REFERENCES articles(id)
);

CREATE INDEX idx_articles_date_added ON articles(date_added DESC);
CREATE INDEX idx_articles_is_read ON articles(is_read);
CREATE INDEX idx_references_date ON references(date_added DESC);
```

## API Routes (Next.js App Router)

### GET /api/articles
Returns all articles (id, title, source, date_added, excerpt, is_read, has_notes).
Query params: ?search=term (optional, server-side backup search)

### GET /api/articles/[id]
Returns full article with content_html, notes, curator_note, pdf_path.

### POST /api/notes
Body: { articleId: string, notes: string }
Writes notes to database and to data/notes/{articleId}.md

### POST /api/read
Body: { articleId: string }
Marks article as read (is_read = 1)

### GET /api/references
Returns all references from the references table.

## Component Structure

### `src/components/TitleBar.tsx`
- Fixed top bar, 30px height
- Left: "NEWSROOM" text (h1, same style as sound site)
- Right: Search input (styled to match site aesthetic — minimal, no border-radius, 1px solid #222 border)

### `src/components/Sidebar.tsx`
- Fixed left sidebar, 248px wide
- Lists all articles: title + source name below
- Active/selected article gets black background + white text
- Read articles: opacity 0.4 (greyed out)
- Unread articles: full opacity
- Clicking an article sets it as active + marks as read

### `src/components/ArticleFeed.tsx`
- Default view when no article selected
- Reverse chronological list of all articles
- Each entry: title (larger), source, date, excerpt (1-2 lines)
- Read articles greyed out (opacity 0.4)
- Click → navigates to article reader

### `src/components/ArticleReader.tsx`
- Full article view
- Top: curator note in a subtle, smaller font (italic or muted color)
- Below: title (h1), author, source + link, date
- Body: rendered markdown/HTML content
- Below body: Notes section
  - Editable textarea (markdown)
  - "Save" button (posts to /api/notes)
- Below notes: "Download PDF" link/button
- At bottom: collapsible "References" section (click to expand/collapse)

### `src/components/SearchBar.tsx`
- Inside TitleBar
- Uses MiniSearch on client side
- Searches article titles + content
- Results filter the sidebar list in real-time

### `src/lib/db.ts`
- SQLite database initialization and helper functions
- getArticles(), getArticle(id), markAsRead(id), saveNotes(id, notes)
- getReferences()
- initDb() — creates tables if not exist

## Mock Data
Create 5-8 seed articles for development. Use real article titles/sources from the user's Are.na collection:

1. "Cory Arcangel Thinks Michel Majerus Was a Space Invader" — Spike Art Magazine
2. "Is There Such a Thing as Too Much Good Taste?" — The New Yorker
3. "Paul Chan Vowed to Stop Making Screen-Based Art. Then Came A.I." — Cultured
4. "The Painted Protest" — Harper's Magazine
5. "Richard Serra: Running Arcs (For John Cage) (1992)" — Brooklyn Rail
6. "LUCK OF THE DRAW: THE ART OF MICHAEL WILLIAMS" — Artforum
7. "Tech That Won't Die, No Matter How Hard Capitalism Tries" — Fakewhale
8. "Hackers and Painters" — Paul Graham

For each, generate realistic excerpt text (~200 chars), a curator note, and some lorem-style content_markdown (a few paragraphs).

## CSS Approach
Use a single globals.css file with the exact nagizin/sound patterns. NO Tailwind utility classes. The aesthetic is:
- Clean, minimal, monochrome
- Black borders (#222), white background
- No rounded corners, no shadows, no gradients
- Font sizes: sidebar items 0.8rem, content text ~0.9rem, titles 1.1-1.3rem
- Everything feels like a well-designed index/catalog

## Important Notes
- The site runs as a Next.js server (not static export) because it needs API routes for notes/read state
- SQLite database lives in data/newsroom.db
- PDFs will live in data/pdfs/ (served via API route, not public/)
- Notes saved to both SQLite and data/notes/{id}.md (git-backed)
- No authentication — fully public
- No categories, no tags, no filtering (just search + chronological)
- The right-side content area scrolls independently from the sidebar

## Build Order
1. Set up globals.css with fonts and base styles
2. Build TitleBar + Sidebar layout (get the visual frame right FIRST)
3. Build the SQLite database layer + seed data
4. Build API routes
5. Build ArticleFeed (default view)
6. Build ArticleReader (article detail view)
7. Build search
8. Wire everything together
9. Test that it runs on localhost:3000
