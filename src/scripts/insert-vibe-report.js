const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/newsroom.db'));
const id = 'vibe-report-grand-optimization';

// Remove if exists
db.prepare('DELETE FROM articles WHERE id = ?').run(id);

const content_markdown = `# The Grand Optimization
## Vibe Report №1 — March 2026

*On the flattening of the internet, the enshittification of platforms, the maker movement's content crisis, and the slow death of weird.*

---

## 01 — Before the Boulevards

John Rafman compared the early internet to medieval Paris — a city that was never modern in any way. Extremely difficult to cross, especially for militaries. No defined streets. An enclave of separate parts, each with its own logic, its own customs, its own smell.

The early internet was disorganized. Non-hierarchical web networks of individual sites that closely resembled this medieval organization. Blogs flourished. Individual websites were not under any optimization. People celebrated their individuality, creating their own pages and making their own tools.

> What happened to Paris, and what happened to the internet, was the construction of the grand boulevards.

The Haussmann renovation of Paris demolished medieval neighborhoods, deemed overcrowded and unhealthy, and constructed large streets through the city that made Paris very carriage- and military-friendly. Legible. Controllable. Efficient.

The early internet was full of piracy, uncontrollable. Napster. LimeWire. File-sharing tools that operated like alleyways — unpoliced, unlit, thrilling. Corporations with interest in tapping into new advertising strategies pushed for the construction of the internet equivalent of Haussmann's renovation.

**That renovation was the creation of platforms.**

---

## 02 — The Middle Man

Nobody really goes to websites anymore. Everyone stays on their feeds. Instagram, TikTok, Facebook, Twitter, and now ChatGPT. The platform economy made it much easier to capitalize and optimize for advertising dollars, even though a lot of these early platforms failed to make much of a profit when they started.

The grand consolidation: people moving away from the open web into the funnel of tightly controlled platforms. The middle man. An intermediary between creators and consumers that was supposed to solve the discovery problem.

In the early days of platforms like YouTube, content creation thrived and the need to optimize wasn't so enforced. People were informal, uploading casually. But as time went on, and more content became available, platforms needed to filter and sort. It was becoming overbearing.

With the influence of advertising on sites, the longer you kept users, the more ads you could serve them. This caused a change in objective for a lot of these platforms:

> Keep the user on the site as long as possible.

This was the start of optimization.

Intermediaries are part of the solution to the age-old problem of connecting people with one another — but they become part of the problem when they grow so powerful that they can act as gatekeepers who usurp the relationship between the two sides of their markets.

---

## 03 — The Thumbnail Arms Race

Every time you go on YouTube the thumbnails keep getting more colorful. Larger faces. More emotional expressions. Thirty-something grown men making contorted faces, talking about how they just learned to give AI some memory optimization or how to control its scripting behavior.

Open-mouthed weird expressions. AI-generated backgrounds. Neon gradients. Red arrows pointing at nothing. Before-and-after splits. The face is always the same face: eyebrows up, mouth open, pupils dilated. Performed surprise as a growth hack.

**The content has bent itself into a misshapen, malformed picture.**

### The Approval Matrix

As someone who grew up with Instagram, pre-2016 Instagram without algorithms — it was a very fun place. You could follow who you wanted, then those posts would show up on your feed. Once you reached the end, it wouldn't show you any more. There was no infinite scroll. The explore page was pretty awful and just random content. There were no Reels, no suggested content. Your posts would be snapshots. Informal. Non-curated. It wasn't so thought out.

Started wondering why everyone posts the same types of photos, same angles, same approaches. Nobody really wants to stand out. Being weird or having an unconventional take doesn't work in this sort of approval-matrix social media. Everyone is now playing a new status game dictated by what more famous people are doing, what trends they are setting, what is beautiful.

This has always happened. But not at this scale. Not in such a regimented and systematic way.

---

## 04 — Vibe Coding & The Slop Economy

"Vibe coding" arrived as an ethos: you don't need to understand what you're building, you just need to describe it and the machine builds it. The maker movement — once rooted in craft, in understanding your materials, in the dignity of building something with your hands and your mind — mutated. The tools got so easy that the understanding became optional.

The result is slop. Not garbage — garbage implies intention. Slop is what happens when production has no friction and distribution has no cost. It fills every surface. It looks like content. It reads like content. It performs the metrics of content. But nothing is behind it.

> The marginal cost of content is now less than a latte. The marginal value is approaching the same.

The maker movement said: anyone can build. The optimization machine heard: everyone must produce. The difference between those two sentences is the entire problem.

### Ahistorism

It is strange to believe the origins of the internet — how weird and fragile and human it once was. How much of what we lost, we lost so gradually that it registered as progress. Each individual optimization was reasonable. Each individual compromise was small. The accumulation is the catastrophe.

How did we get here? The same way Paris got its boulevards. Slowly, and then all at once, and then no one could remember what the streets looked like before.

---

## 05 — Glossary of Decline

**ENSHITTIFICATION** — Cory Doctorow's term for the platform lifecycle: first be good to users, then abuse users to make things better for business customers, then abuse those business customers to claw back value for the platform itself. The final stage is a pile of shit.

**SLOP** — AI-generated or AI-assisted content produced without editorial intent. Distinguished from spam by its lack of malice. It doesn't want to trick you. It doesn't want anything. That's the problem.

**VIBE CODING** — Building software through description rather than understanding. The craft removed from craft. Works until it doesn't, at which point no one knows why.

**THE APPROVAL MATRIX** — The implicit scoring system of algorithmic feeds that rewards conformity and punishes deviation. Everyone posts the same photo because the same photo works.

**THE GRAND BOULEVARDS** — Platforms as infrastructure projects that replaced the medieval web. More efficient, more legible, more controllable. Less alive.

**THUMBNAIL CONVERGENCE** — The evolutionary endpoint of click-through-rate optimization. All thumbnails become the same thumbnail: big face, bright colors, open mouth, performed emotion. Natural selection for attention.
`;

db.prepare(`
  INSERT INTO articles (id, title, author, source, source_url, date_published, date_added, curator_note, content_markdown, content_html, excerpt, pdf_path, is_read, notes, search_text)
  VALUES (@id, @title, @author, @source, @source_url, @date_published, @date_added, @curator_note, @content_markdown, @content_html, @excerpt, @pdf_path, 0, '', @search_text)
`).run({
  id,
  title: 'The Grand Optimization — Vibe Report №1',
  author: 'Reid Surmeier',
  source: 'Vibe Report',
  source_url: '/pdfs/the-grand-optimization.pdf',
  date_published: '2026-03-11',
  date_added: new Date().toISOString(),
  curator_note: null,
  content_markdown,
  content_html: null,
  excerpt: "On the flattening of the internet, the enshittification of platforms, the maker movement's content crisis, and the slow death of weird.",
  pdf_path: '/pdfs/the-grand-optimization.pdf',
  search_text: 'The Grand Optimization vibe report enshittification platforms optimization slop vibe coding thumbnails internet Cory Doctorow Haussmann medieval Paris ' + content_markdown,
});

console.log('✅ Article inserted: ' + id);
db.close();
