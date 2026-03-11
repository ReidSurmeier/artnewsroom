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
  hidden?: boolean;
}

export default function Sidebar({ articles, selectedId, onSelect, hidden }: SidebarProps) {
  return (
    <nav className={`sidebar${hidden ? ' hidden-mobile' : ''}`}>
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
