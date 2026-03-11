'use client';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  date_added: string;
  excerpt: string;
  is_read: number;
}

interface ArticleFeedProps {
  articles: ArticleSummary[];
  onSelect: (id: string) => void;
}

export default function ArticleFeed({ articles, onSelect }: ArticleFeedProps) {
  const top3 = articles.slice(0, 3);

  if (top3.length === 0) {
    return (
      <div className="feed-empty">
        <span className="feed-empty-text">No articles yet.</span>
      </div>
    );
  }

  return (
    <div className="feed-top-picks">
      <ul>
        {top3.map(article => (
          <li
            key={article.id}
            className={`sidebar-item${article.is_read ? ' read' : ''}`}
            onClick={() => onSelect(article.id)}
          >
            <span className="sidebar-item-title">{article.title}</span>
            <span className="sidebar-item-source">{article.source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
