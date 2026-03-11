'use client';

import { useState } from 'react';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  date_added: string;
  excerpt: string;
  is_read: number;
}

interface SidebarProps {
  articles: ArticleSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hidden?: boolean;
}

export default function Sidebar({ articles, selectedId, onSelect, hidden }: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const top3 = articles.slice(0, 3);
  const rest = articles.slice(3);

  return (
    <nav className={`sidebar${hidden ? ' hidden-mobile' : ''}`}>
      <ul>
        {top3.map(article => (
          <li
            key={article.id}
            className={`sidebar-item${article.id === selectedId ? ' active' : ''}${article.is_read ? ' read' : ''}`}
            onClick={() => onSelect(article.id)}
          >
            <span className="sidebar-item-title">{article.title}</span>
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
                  <span className="sidebar-item-title">{article.title}</span>
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
