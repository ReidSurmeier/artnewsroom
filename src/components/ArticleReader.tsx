'use client';

import { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';

interface ArticleFull {
  id: string;
  title: string;
  author: string;
  source: string;
  source_url: string;
  date_published: string;
  date_added: string;
  content_html: string;
  content_markdown: string;
  pdf_path: string | null;
  is_read: number;
  notes: string;
}

interface Reference {
  id: number;
  url: string;
  title: string;
  found_in_article_id: string | null;
  date_added: string;
}

interface ArticleReaderProps {
  articleId: string;
  isArchived?: boolean;
  onBack: () => void;
  onSaveNotes: (articleId: string, notes: string) => Promise<void>;
  onArchive: (articleId: string, archived: boolean) => Promise<void>;
}

export default function ArticleReader({ articleId, isArchived, onBack, onSaveNotes, onArchive }: ArticleReaderProps) {
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/articles/${articleId}`)
      .then(r => r.json())
      .then(data => {
        setArticle(data);
        setNotes(data.notes || '');
      });

    fetch('/api/references')
      .then(r => r.json())
      .then((refs: Reference[]) => {
        setReferences(
          refs.filter(r => r.found_in_article_id === articleId || !r.found_in_article_id)
        );
      });
  }, [articleId]);

  const handleSave = async () => {
    await onSaveNotes(articleId, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderedHtml = useMemo(() => {
    if (article?.content_html) return article.content_html;
    if (article?.content_markdown) return marked.parse(article.content_markdown) as string;
    return '';
  }, [article?.content_html, article?.content_markdown]);

  if (!article) return null;

  return (
    <div className={`article-reader-wrapper${panelOpen ? ' panel-open' : ''}`}>
      <div className="article-reader">
        <div className="article-top-actions">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <button
            className={`archive-btn${isArchived ? ' archived' : ''}`}
            onClick={() => onArchive(articleId, !isArchived)}
          >
            {isArchived ? '↩ Unarchive' : '↓ Archive'}
          </button>
        </div>

        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">
          {article.author && <>{article.author} &middot; </>}
          <a href={article.source_url} target="_blank" rel="noopener noreferrer">
            {article.source}
          </a>
          {article.date_published && <> &middot; {article.date_published}</>}
        </div>

        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {article.pdf_path && (
          <a href={article.pdf_path} className="pdf-btn" download>
            Download PDF
          </a>
        )}
      </div>

      <button
        className="side-panel-tab"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        Notes
      </button>

      {panelOpen && (
        <div className="side-panel">
          <div className="side-panel-header">
            <h3>Notes</h3>
            <button className="side-panel-close" onClick={() => setPanelOpen(false)}>&times;</button>
          </div>
          <textarea
            className="notes-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Write notes here (markdown)..."
          />
          <div className="side-panel-actions">
            <button className="notes-save-btn" onClick={handleSave}>Save</button>
            {saved && <span className="notes-saved">Saved</span>}
          </div>

          {references.length > 0 && (
            <div className="references-section">
              <button
                className="references-toggle"
                onClick={() => setRefsOpen(!refsOpen)}
              >
                {refsOpen ? '▾' : '▸'} References ({references.length})
              </button>
              {refsOpen && (
                <ul className="references-list">
                  {references.map(ref => (
                    <li key={ref.id}>
                      <a href={ref.url} target="_blank" rel="noopener noreferrer">
                        {ref.title || ref.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
