'use client';

import { useState, useEffect, useCallback } from 'react';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import ArticleFeed from '@/components/ArticleFeed';
import ArticleReader from '@/components/ArticleReader';
import WritersView from '@/components/WritersView';

interface ArticleSummary {
  id: string;
  title: string;
  source: string;
  author?: string;
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
  const [showWriters, setShowWriters] = useState(false);
  const [trackedWriters, setTrackedWriters] = useState<string[]>([]);

  // New mode states
  const [drawMode, setDrawMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const loadArticles = () => {
    fetch('/api/articles').then(r => r.json()).then(setArticles);
  };

  const loadArchived = () => {
    fetch('/api/articles?archived=true').then(r => r.json()).then(setArchivedArticles);
  };

  const loadWriters = () => {
    fetch('/api/writers').then(r => r.json()).then((writers: { name: string }[]) => {
      setTrackedWriters(writers.map(w => w.name.toLowerCase()));
    });
  };

  useEffect(() => {
    loadArticles();
    loadWriters();
  }, []);

  useEffect(() => {
    if (showArchive) loadArchived();
  }, [showArchive]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (!selectedId) return;

      // Shift+F = focus mode toggle
      if (e.key === 'F' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Escape = exit focus
      if (e.key === 'Escape') {
        if (focusMode) setFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, focusMode]);

  const currentArticles = showArchive ? archivedArticles : articles;
  const filteredArticles = filterIds
    ? currentArticles.filter(a => filterIds.includes(a.id))
    : currentArticles;

  const handleFilter = useCallback((ids: string[] | null) => {
    setFilterIds(ids);
  }, []);

  const selectArticle = async (id: string) => {
    if (!id) {
      setShowWriters(false);
      setSelectedId(null);
      return;
    }
    setShowWriters(false);
    setSelectedId(id);
    // Reset modes when switching articles
    setDrawMode(false);
    setFocusMode(false);
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
    setDrawMode(false);
    setFocusMode(false);
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
    loadArticles();
    loadArchived();
    setSelectedId(null);
  };

  const toggleArchive = () => {
    setShowArchive(prev => !prev);
    setSelectedId(null);
    setFilterIds(null);
    setShowWriters(false);
  };

  const handleShowWriters = () => {
    setShowWriters(true);
    setSelectedId(null);
  };

  const toggleDraw = () => setDrawMode(prev => !prev);
  const toggleFocus = () => {
    setFocusMode(prev => !prev);
    setDrawMode(false);
  };

  const selectedArticle = currentArticles.find(a => a.id === selectedId);
  const hideSidebar = !!selectedId || focusMode;

  return (
    <div className={`app-root${focusMode ? ' focus-mode' : ''}`}>
      <TitleBar
        articles={currentArticles}
        onFilter={handleFilter}
        showArchive={showArchive}
        onToggleArchive={toggleArchive}
        articleSelected={!!selectedId}
        drawMode={drawMode}
        onToggleDraw={toggleDraw}
        focusMode={focusMode}
        onToggleFocus={toggleFocus}
        showWriters={showWriters}
        onShowWriters={handleShowWriters}
      />
      {!focusMode && (
        <Sidebar
          articles={filteredArticles}
          selectedId={selectedId}
          onSelect={selectArticle}
          hidden={hideSidebar}
          trackedWriters={trackedWriters}
          onShowWriters={handleShowWriters}
          showingWriters={showWriters}
        />
      )}
      <main className={`content-area${selectedId ? ' article-open' : ''}${focusMode ? ' focus-content' : ''}`}>
        {showWriters ? (
          <WritersView />
        ) : selectedId ? (
          <ArticleReader
            articleId={selectedId}
            isArchived={!!selectedArticle?.is_archived}
            onBack={goBack}
            onSaveNotes={saveNotes}
            onArchive={handleArchive}
            drawMode={drawMode}
            focusMode={focusMode}
          />
        ) : null}
      </main>
    </div>
  );
}
