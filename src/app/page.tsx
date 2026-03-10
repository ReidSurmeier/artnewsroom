'use client';

import { useState, useEffect, useCallback } from 'react';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import ArticleFeed from '@/components/ArticleFeed';
import ArticleReader from '@/components/ArticleReader';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  date_added: string;
  excerpt: string;
  is_read: number;
}

export default function Home() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterIds, setFilterIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/articles')
      .then(r => r.json())
      .then(setArticles);
  }, []);

  const filteredArticles = filterIds
    ? articles.filter(a => filterIds.includes(a.id))
    : articles;

  const handleFilter = useCallback((ids: string[] | null) => {
    setFilterIds(ids);
  }, []);

  const selectArticle = async (id: string) => {
    setSelectedId(id);
    const article = articles.find(a => a.id === id);
    if (article && !article.is_read) {
      await fetch('/api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      });
      setArticles(prev =>
        prev.map(a => (a.id === id ? { ...a, is_read: 1 } : a))
      );
    }
  };

  const goBack = () => {
    setSelectedId(null);
  };

  const saveNotes = async (articleId: string, notes: string) => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, notes }),
    });
  };

  return (
    <>
      <TitleBar articles={articles} onFilter={handleFilter} />
      <Sidebar
        articles={filteredArticles}
        selectedId={selectedId}
        onSelect={selectArticle}
      />
      <main className="content-area">
        {selectedId ? (
          <ArticleReader
            articleId={selectedId}
            onBack={goBack}
            onSaveNotes={saveNotes}
          />
        ) : (
          <ArticleFeed
            articles={filteredArticles}
            onSelect={selectArticle}
          />
        )}
      </main>
    </>
  );
}
