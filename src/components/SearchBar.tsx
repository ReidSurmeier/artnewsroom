'use client';

import { useEffect, useRef, useCallback } from 'react';
import MiniSearch from 'minisearch';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  excerpt: string;
}

interface SearchBarProps {
  articles: ArticleSummary[];
  onFilter: (ids: string[] | null) => void;
}

export default function SearchBar({ articles, onFilter }: SearchBarProps) {
  const miniSearchRef = useRef<MiniSearch | null>(null);
  const queryRef = useRef('');

  useEffect(() => {
    const ms = new MiniSearch({
      fields: ['title', 'source', 'excerpt'],
      storeFields: ['title', 'source', 'excerpt'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 2, source: 1.5 },
      },
    });
    ms.addAll(articles);
    miniSearchRef.current = ms;

    // Re-run current query against new index
    if (queryRef.current.trim()) {
      const results = ms.search(queryRef.current);
      onFilter(results.map(r => r.id as string));
    }
  }, [articles, onFilter]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      queryRef.current = q;
      if (!q.trim()) {
        onFilter(null);
        return;
      }
      if (miniSearchRef.current) {
        const results = miniSearchRef.current.search(q);
        onFilter(results.map(r => r.id as string));
      }
    },
    [onFilter]
  );

  return (
    <input
      type="text"
      className="search-input"
      placeholder="Search..."
      onChange={handleChange}
    />
  );
}
