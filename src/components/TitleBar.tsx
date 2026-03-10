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
}

export default function TitleBar({ articles, onFilter }: TitleBarProps) {
  return (
    <header className="title-bar">
      <h1>NEWSROOM</h1>
      <SearchBar articles={articles} onFilter={onFilter} />
    </header>
  );
}
