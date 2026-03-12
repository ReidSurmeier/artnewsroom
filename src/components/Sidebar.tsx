'use client';

import { useState, useMemo } from 'react';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  author?: string;
  date_added: string;
  excerpt: string;
  is_read: number;
  has_images?: number;
  content_length?: number;
}

interface SidebarProps {
  articles: ArticleSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hidden?: boolean;
  trackedWriters?: string[];
  onShowWriters?: () => void;
  showingWriters?: boolean;
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (date >= todayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaySortKey(dateStr: string): string {
  return dateStr.slice(0, 10); // YYYY-MM-DD for grouping
}

export default function Sidebar({ articles, selectedId, onSelect, hidden, trackedWriters = [], onShowWriters, showingWriters }: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  const isTrackedWriter = (article: ArticleSummary) => {
    if (!article.author || trackedWriters.length === 0) return false;
    const authorLower = article.author.toLowerCase();
    return trackedWriters.some(w => authorLower.includes(w));
  };

  // Top 3 picks: long-form prose (10k+ chars ≈ 2000+ words), with images, diverse sources
  // Always reserve one slot for Personal Canon (Celine Nguyen)
  const MIN_LENGTH = 10000;
  const PINNED_SOURCE = 'Personal Canon';
  const longForm = articles.filter(a => a.has_images === 1 && (a.content_length || 0) >= MIN_LENGTH);
  const top3: ArticleSummary[] = [];
  const usedSources = new Set<string>();

  // First, try to pin a Personal Canon article
  const pinnedArticle = longForm.find(a => a.source === PINNED_SOURCE);
  if (pinnedArticle) {
    top3.push(pinnedArticle);
    usedSources.add(PINNED_SOURCE);
  }

  // Fill remaining slots with diverse sources
  for (const a of longForm) {
    if (top3.length >= 3) break;
    if (usedSources.has(a.source)) continue;
    top3.push(a);
    usedSources.add(a.source);
  }
  const top3Ids = new Set(top3.map(a => a.id));
  const rest = articles.filter(a => !top3Ids.has(a.id));

  // Group rest by day
  const dayGroups = useMemo(() => {
    const groups: { key: string; label: string; articles: ArticleSummary[] }[] = [];
    const groupMap = new Map<string, ArticleSummary[]>();
    const labelMap = new Map<string, string>();

    for (const a of rest) {
      const key = getDaySortKey(a.date_added);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        labelMap.set(key, getDayLabel(a.date_added));
      }
      groupMap.get(key)!.push(a);
    }

    // Sort by date descending
    const sortedKeys = [...groupMap.keys()].sort((a, b) => b.localeCompare(a));
    for (const key of sortedKeys) {
      groups.push({ key, label: labelMap.get(key)!, articles: groupMap.get(key)! });
    }
    return groups;
  }, [rest]);

  const toggleDay = (key: string) => {
    setOpenDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderArticle = (article: ArticleSummary) => (
    <li
      key={article.id}
      className={`sidebar-item${article.id === selectedId ? ' active' : ''}${article.is_read ? ' read' : ''}`}
      onClick={() => onSelect(article.id)}
    >
      <span className="sidebar-item-title">
        {isTrackedWriter(article) && <span className="tracked-dot" />}
        {article.title}
      </span>
      <span className="sidebar-item-source">{article.source}</span>
    </li>
  );

  return (
    <nav className={`sidebar${hidden ? ' hidden-mobile' : ''}`}>

      <ul>
        {top3.map(renderArticle)}
      </ul>

      {rest.length > 0 && (
        <>
          <button
            className="sidebar-more-toggle"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            {moreOpen ? '▾' : '▸'} More ({rest.length})
          </button>
          {moreOpen && dayGroups.map(group => (
            <div key={group.key}>
              <button
                className="sidebar-day-toggle"
                onClick={() => toggleDay(group.key)}
              >
                {openDays.has(group.key) ? '▾' : '▸'} {group.label} ({group.articles.length})
              </button>
              {openDays.has(group.key) && (
                <ul>
                  {group.articles.map(renderArticle)}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </nav>
  );
}
