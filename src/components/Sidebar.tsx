'use client';

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
}

export default function Sidebar({ articles, selectedId, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar">
      <ul>
        {articles.map(article => (
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
    </nav>
  );
}
