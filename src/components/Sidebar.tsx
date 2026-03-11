'use client';

import { useState } from 'react';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  author?: string;
  date_added: string;
  excerpt: string;
  is_read: number;
  has_images?: number;
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

export default function Sidebar({ articles, selectedId, onSelect, hidden, trackedWriters = [], onShowWriters, showingWriters }: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const isTrackedWriter = (article: ArticleSummary) => {
    if (!article.author || trackedWriters.length === 0) return false;
    const authorLower = article.author.toLowerCase();
    return trackedWriters.some(w => authorLower.includes(w));
  };

  // Top 3 picks must have images — no empty shells
  const withImages = articles.filter(a => a.has_images === 1);
  const withoutImages = articles.filter(a => a.has_images !== 1);
  const top3 = withImages.slice(0, 3);
  const rest = [...withImages.slice(3), ...withoutImages];

  return (
    <nav className={`sidebar${hidden ? ' hidden-mobile' : ''}`}>

      <ul>
        {top3.map(article => (
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
        ))}
      </ul>

      {rest.length > 0 && (
        <>
          <button
            className="sidebar-more-toggle"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            {moreOpen ? '▾' : '▸'} More ({rest.length})
          </button>
          {moreOpen && (
            <ul>
              {rest.map(article => (
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
              ))}
            </ul>
          )}
        </>
      )}
    </nav>
  );
}
