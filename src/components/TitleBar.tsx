'use client';

import SearchBar from './SearchBar';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  excerpt: string;
}

interface TitleBarProps {
  articles: ArticleSummary[];
  onFilter: (ids: string[] | null) => void;
  showArchive: boolean;
  onToggleArchive: () => void;
}

export default function TitleBar({ articles, onFilter, showArchive, onToggleArchive }: TitleBarProps) {
  return (
    <header className="title-bar">
      <h1>NEWSROOM</h1>
      <div className="title-bar-actions">
        <button
          className={`archive-toggle-btn${showArchive ? ' active' : ''}`}
          onClick={onToggleArchive}
        >
          {showArchive ? '← Feed' : 'Archive'}
        </button>
        <SearchBar articles={articles} onFilter={onFilter} />
      </div>
    </header>
  );
}
