/**
 * Strip boilerplate / CTA / promotional cruft from article content.
 * Run on both markdown and HTML.
 */

// Lines containing any of these patterns get removed entirely
const LINE_KILL_PATTERNS = [
  /download\s+a\s+transcript/i,
  /listen\s+and\s+subscribe/i,
  /apple\s*\|\s*spotify/i,
  /wherever\s+you\s+listen/i,
  /sign\s+up\s+to\s+receive/i,
  /weekly\s+cultural[- ]recommendations/i,
  /sign\s+up\s+for\s+(the|our)\s+.*newsletter/i,
  /subscribe\s+to\s+(the|our)\s+.*newsletter/i,
  /get\s+the\s+.*newsletter/i,
  /share\s+this\s+(article|story|post)/i,
  /follow\s+us\s+on/i,
  /related\s+articles?/i,
  /more\s+from\s+(the\s+)?new\s+yorker/i,
  /more\s+from\s+(the\s+)?atlantic/i,
  /recommended\s+for\s+you/i,
  /you\s+might\s+also\s+like/i,
  /read\s+more\s+about/i,
  /a\s+weekly\s+newsletter/i,
  /subscribe\s+now/i,
  /become\s+a\s+(subscriber|member)/i,
  /already\s+a\s+subscriber/i,
  /this\s+(article|story)\s+appears?\s+in/i,
  /goings\s+on/i,
  /the\s+current\s+cinema/i,
  /spring\s+culture\s+preview/i,
  /what['']?s\s+new\s+in\s+theatre/i,
  /intcid=_the-new-yorker/i,
  /#intcid=/i,
  /support\s+the\s+guardian/i,
  /open\s+in\s+app/i,
  /continue\s+reading\s+the\s+main\s+story/i,
  /advertisement/i,
  /\bAD\b/,
  /click\s+here\s+to/i,
  /tap\s+here\s+to/i,
];

// Block-level patterns: if a paragraph/section matches, remove the whole block
const BLOCK_KILL_PATTERNS = [
  /^#{1,3}\s*(related|more\s+stories|recommended|also\s+read|further\s+reading)/i,
  /^#{1,3}\s*(goings\s+on|the\s+current\s+cinema)/i,
];

export function sanitizeMarkdown(md: string): string {
  if (!md) return md;

  const lines = md.split('\n');
  const cleaned: string[] = [];
  let skipBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we hit a block-kill header
    if (BLOCK_KILL_PATTERNS.some(p => p.test(line))) {
      skipBlock = true;
      continue;
    }

    // If we're in a skip block, stop skipping at the next heading or end
    if (skipBlock) {
      if (/^#{1,3}\s/.test(line) && !BLOCK_KILL_PATTERNS.some(p => p.test(line))) {
        skipBlock = false;
      } else {
        continue;
      }
    }

    // Check line-level kills
    if (LINE_KILL_PATTERNS.some(p => p.test(line))) {
      continue;
    }

    cleaned.push(line);
  }

  // Trim trailing empty lines
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') {
    cleaned.pop();
  }

  return cleaned.join('\n');
}

export function sanitizeHtml(html: string): string {
  if (!html) return html;

  // Remove paragraphs/divs containing kill patterns
  for (const pattern of LINE_KILL_PATTERNS) {
    // Remove <p>...</p> blocks containing the pattern
    html = html.replace(new RegExp(`<p[^>]*>[^<]*${pattern.source}[^<]*</p>`, 'gi'), '');
    // Remove <div>...</div> blocks containing the pattern (non-greedy, single div)
    html = html.replace(new RegExp(`<div[^>]*>[^<]*${pattern.source}[^<]*</div>`, 'gi'), '');
    // Remove <a>...</a> links containing the pattern
    html = html.replace(new RegExp(`<a[^>]*>[^<]*${pattern.source}[^<]*</a>`, 'gi'), '');
  }

  // Remove links with intcid tracking params (New Yorker recommendation blocks)
  html = html.replace(/<a[^>]*intcid=[^>]*>[\s\S]*?<\/a>/gi, '');

  return html;
}
