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
  return (
    <div>
      {articles.map(article => (
        <div
          key={article.id}
          className={`feed-item${article.is_read ? ' read' : ''}`}
          onClick={() => onSelect(article.id)}
        >
          <div className="feed-item-title">{article.title}</div>
          <div className="feed-item-meta">
            {article.source} &middot; {article.date_added}
          </div>
        </div>
      ))}
    </div>
  );
}
