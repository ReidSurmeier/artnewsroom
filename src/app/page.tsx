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
  is_archived: number;
}

export default function Home() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [archivedArticles, setArchivedArticles] = useState<ArticleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterIds, setFilterIds] = useState<string[] | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const loadArticles = () => {
    fetch('/api/articles').then(r => r.json()).then(setArticles);
  };

  const loadArchived = () => {
    fetch('/api/articles?archived=true').then(r => r.json()).then(setArchivedArticles);
  };

  useEffect(() => {
    loadArticles();
  }, []);

  useEffect(() => {
    if (showArchive) loadArchived();
  }, [showArchive]);

  const currentArticles = showArchive ? archivedArticles : articles;
  const filteredArticles = filterIds
    ? currentArticles.filter(a => filterIds.includes(a.id))
    : currentArticles;

  const handleFilter = useCallback((ids: string[] | null) => {
    setFilterIds(ids);
  }, []);

  const selectArticle = async (id: string) => {
    setSelectedId(id);
    const article = currentArticles.find(a => a.id === id);
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

  const handleArchive = async (articleId: string, archived: boolean) => {
    await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, archived }),
    });
    // Refresh both lists
    loadArticles();
    loadArchived();
    // Go back to list after archiving
    setSelectedId(null);
  };

  const toggleArchive = () => {
    setShowArchive(prev => !prev);
    setSelectedId(null);
    setFilterIds(null);
  };

  const selectedArticle = currentArticles.find(a => a.id === selectedId);

  return (
    <>
      <TitleBar
        articles={currentArticles}
        onFilter={handleFilter}
        showArchive={showArchive}
        onToggleArchive={toggleArchive}
      />
      <Sidebar
        articles={filteredArticles}
        selectedId={selectedId}
        onSelect={selectArticle}
      />
      <main className="content-area">
        {selectedId ? (
          <ArticleReader
            articleId={selectedId}
            isArchived={!!selectedArticle?.is_archived}
            onBack={goBack}
            onSaveNotes={saveNotes}
            onArchive={handleArchive}
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
