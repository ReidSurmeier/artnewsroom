# ART NEWSROOM — Decision Log (from previous sessions)

## Core Decisions

### Content
- **3 articles per day**, high quality sourcing
- **Curator/digest note** per article: what it connects to, how it was found, what human source led to it
- **References**: kept as links in separate database column, collapsible dropdown in UI — all references pooled together (not categorized per article)
- **Reference articles**: NOT downloaded, just stored as links
- **Deduplication**: Give both if same topic covered by different sources
- **No categories, no tags, no filtering** — just search + chronological

### UI/UX
- **Sidebar**: title + source only (no thumbnails)
- **Click article**: reader view on right side (extracted text rendered as HTML, NOT PDF viewer)
- **PDF**: downloadable via button, not the primary reading format
- **Default view** (no article selected): reverse-chronological feed of all articles
- **Read/unread**: greyed out if read (opacity)
- **Curator note**: shown at top of article after clicking (not in sidebar or feed)
- **References**: collapsible section at bottom of article reader
- **Notes**: single markdown field per article, visible to anyone viewing the site
- **Search**: search box at top above sidebar, client-side (MiniSearch/Fuse.js)

### Hosting & Storage
- **Cloudflare Tunnel**: Next.js runs locally on machine, Cloudflare provides public URL
- **Domain**: subdomain of reidsurmeier.wtf (e.g., newsroom.reidsurmeier.wtf)
- **PDFs**: stored on local disk (~/artnewsroom/data/pdfs/)
- **Notes**: git-backed (Option A) — UI writes to disk, background process commits
- **Notes flow**: POST to /api/notes → writes to data/notes/{id}.md → periodic git commit/push
- **Auto-commit**: cron job pushes new articles + note changes to repo

### Editorial Profile
**Always pick:**
- Artist interviews (art + technology, painting, sculpture, curation)
- Critical essays on contemporary art practice
- Art education pieces (MFA programs, RISD, SAIC, CalArts, Yale)
- Technology criticism through cultural/artistic lens
- Independent publishing, small press, artist books
- Digital art, net art, computational art, generative art
- Art history deep dives
- Essays on taste, aesthetics, creative practice
- Long-form personal essays intersecting art/culture

**Usually pick:**
- Design criticism and visual culture
- Photography criticism and theory
- Literary criticism (when intersecting with art)
- Philosophy of art and aesthetics
- Media theory and internet culture criticism
- Independent blogger/thinker essays on creativity and technology

**Always skip:**
- Celebrity profiles/gossip
- Red carpet / fashion week coverage
- TV show and movie reviews
- Finance, markets, crypto
- Model profiles and lifestyle pieces
- Art market news (auction results, prices)
- Generic "AI will replace artists" takes
- Listicles and lightweight roundups
- Product launches and tech gadget reviews

### Source List (~40 sources)

**Tier 1 — Explicitly named:**
1. spikeartmagazine.com
2. newyorker.com
3. nytimes.com (T Magazine, arts/design, Style)
4. culturedmag.com
5. arachnemag.substack.com
6. dazeddigital.com
7. news.ycombinator.com (Hacker News)
8. harpers.org
9. yalereview.org
10. thecreativeindependent.com
11. artforum.com
12. nplusonemag.com
13. brooklynrail.org
14. news.artnet.com
15. Gagosian Quarterly (gagosian.com)
16. aresluna.org
17. hyperallergic.com
18. theintrinsicperspective.com
19. henrikkarlsson.xyz
20. asteriskmag.com

**Tier 2 — From Are.na + links:**
21. newmodels.io
22. log.fakewhale.xyz
23. publicdomainreview.org
24. flash---art.com (Flash Art)
25. kunstkritikk.com
26. sternberg-press.com
27. pioneerworks.org
28. thedriftmag.com
29. rightclicksave.com
30. syntaxmag.online

**Tier 3 — Independent blogs/substacks:**
31. piperhaywood.com
32. tomcritchlow.com
33. joecarlsmith.com
34. donaldboat.substack.com
35. laurelschwulst.com

**Tier 4 — Added sources:**
36. e-flux.com
37. frieze.com
38. artinamericamagazine.com
39. rhizome.org
40. momus.ca

### Are.na Integration
- Pull from: https://www.are.na/reid-surmeier/articles-essays-bwxdzvfcypq
- Pull from: https://www.are.na/reid-surmeier/philosophy-y7ecpgsohi0
- Use as "taste profile" to calibrate recommendations

### Credentials (saved in .credentials/logins.json)
- NYT: rsurmeie@risd.edu
- New Yorker: ksurmeier@gmail.com
- Atlantic: ksurmeier@gmail.com
- NY Mag: ksurmeier@gmail.com

### Daily Delivery
- No notification/message — articles just appear on the website
- Cron runs at 8am

### Deferred
- YouTube/video/podcast integration (Phase 4, later)
- openclaw-newsroom repo: scan for useful pipeline patterns but build fresh

### Phasing
- Phase 1: Website shell (Next.js, sidebar, reader, search, seed data)
- Phase 2: Pipeline (RSS scanning, article extraction, PDF gen, curation logic, cron)
- Phase 3: Intelligence (Are.na taste profiling, citation chains, source discovery, editorial learning)
- Phase 4: YouTube/video/podcast (deferred)
