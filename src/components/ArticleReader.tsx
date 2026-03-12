'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

interface ArticleImage {
  id: number;
  article_id: string;
  original_url: string;
  ascii_art: string;
  bw_image_path: string;
  alt_text: string;
  position: number;
}

interface Annotation {
  id: number;
  article_id: string;
  highlighted_text: string;
  note_text: string;
  start_offset: number;
  end_offset: number;
  date_added: string;
}

interface ArticleReaderProps {
  articleId: string;
  isArchived?: boolean;
  isSaved?: boolean;
  onBack: () => void;
  onSaveNotes: (articleId: string, notes: string) => Promise<void>;
  onArchive: (articleId: string, archived: boolean) => Promise<void>;
  onSave?: (articleId: string, saved: boolean) => Promise<void>;
  drawMode?: boolean;
  focusMode?: boolean;
}

export default function ArticleReader({ articleId, isArchived, isSaved, onBack, onSaveNotes, onArchive, onSave, drawMode, focusMode }: ArticleReaderProps) {
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [articleImages, setArticleImages] = useState<ArticleImage[]>([]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string; startOffset: number; endOffset: number } | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');
  const [drawPaths, setDrawPaths] = useState<{ tool: string; points: { x: number; y: number }[] }[]>([]);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);

  // Reading progress (for focus mode)
  const [readingProgress, setReadingProgress] = useState(0);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

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

    fetch(`/api/article-images?articleId=${encodeURIComponent(articleId)}`)
      .then(r => r.json())
      .then(setArticleImages);

    // Load annotations
    fetch(`/api/annotations?articleId=${encodeURIComponent(articleId)}`)
      .then(r => r.json())
      .then(setAnnotations);

    // Load drawing — reset first so old article's drawing doesn't persist
    setDrawPaths([]);
    fetch(`/api/drawings?articleId=${encodeURIComponent(articleId)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.drawing_data) {
          try {
            setDrawPaths(JSON.parse(data.drawing_data));
          } catch { /* ignore */ }
        }
      });
  }, [articleId]);

  // Track reading progress for focus mode
  useEffect(() => {
    if (!focusMode) return;
    const el = document.querySelector('.content-area');
    if (!el) return;
    contentAreaRef.current = el as HTMLDivElement;
    const handleScroll = () => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) {
        setReadingProgress(Math.min(1, scrollTop / scrollHeight));
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [focusMode]);

  const handleSave = async () => {
    await onSaveNotes(articleId, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderedHtml = useMemo(() => {
    let html = '';
    if (article?.content_html) html = article.content_html;
    else if (article?.content_markdown) html = marked.parse(article.content_markdown) as string;

    // Replace <img> tags with ASCII art, or strip them entirely
    let imgIndex = 0;
    html = html.replace(/<img[^>]*>/gi, () => {
      const img = articleImages[imgIndex];
      imgIndex++;
      if (!img || !img.ascii_art) return '';
      const alt = img.alt_text ? `<div class="ascii-caption">${escapeHtml(img.alt_text)}</div>` : '';
      return `<div class="ascii-art-container"><pre class="ascii-art">${escapeHtml(img.ascii_art)}</pre>${alt}</div>`;
    });

    return html;
  }, [article?.content_html, article?.content_markdown, articleImages]);

  // Highlight annotated text in content
  const annotatedHtml = useMemo(() => {
    if (annotations.length === 0) return renderedHtml;
    // We use a simple approach: wrap highlighted_text occurrences with a span
    let html = renderedHtml;
    annotations.forEach(ann => {
      const escaped = escapeRegex(ann.highlighted_text);
      const regex = new RegExp(`(${escaped})`, 'i');
      html = html.replace(regex, `<span class="annotated-highlight" data-annotation-id="${ann.id}">$1</span>`);
    });
    return html;
  }, [renderedHtml, annotations]);

  // Handle text selection for creating annotations
  const handleMouseUp = useCallback(() => {
    if (drawMode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      // Don't clear popup if clicking inside popup
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) return;

    // Get text offset within the content
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const fullText = contentEl.textContent || '';
    const startOffset = fullText.indexOf(text);
    const endOffset = startOffset + text.length;

    setSelectionPopup({
      x: rect.right - wrapperRect.left + 10,
      y: rect.top - wrapperRect.top,
      text,
      startOffset,
      endOffset,
    });
  }, [drawMode]);

  const handleCreateAnnotation = async () => {
    if (!selectionPopup) return;
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_id: articleId,
        highlighted_text: selectionPopup.text,
        note_text: '',
        start_offset: selectionPopup.startOffset,
        end_offset: selectionPopup.endOffset,
      }),
    });
    const data = await res.json();
    const newAnn: Annotation = {
      id: data.id,
      article_id: articleId,
      highlighted_text: selectionPopup.text,
      note_text: '',
      start_offset: selectionPopup.startOffset,
      end_offset: selectionPopup.endOffset,
      date_added: new Date().toISOString().slice(0, 10),
    };
    setAnnotations(prev => [...prev, newAnn]);
    setSelectionPopup(null);
    setEditingAnnotation(data.id);
    setEditNoteText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleSaveAnnotation = async (id: number) => {
    await fetch('/api/annotations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, note_text: editNoteText }),
    });
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, note_text: editNoteText } : a));
    setEditingAnnotation(null);
  };

  const handleDeleteAnnotation = async (id: number) => {
    await fetch(`/api/annotations?id=${id}`, { method: 'DELETE' });
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  // Drawing logic
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPaths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'eraser' ? 'rgba(255,255,255,1)' : '#000';
      ctx.lineWidth = path.tool === 'eraser' ? 12 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  }, [drawPaths]);

  // Resize canvas to match content area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.scrollWidth;
      canvas.height = parent.scrollHeight;
      redrawCanvas();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redrawCanvas, article]);

  useEffect(() => {
    redrawCanvas();
  }, [drawPaths, redrawCanvas]);

  // Scale ASCII art to match paragraph width
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const scaleAsciiArt = () => {
      const pres = content.querySelectorAll<HTMLPreElement>('pre.ascii-art');
      pres.forEach(pre => {
        // Get the first line to determine character count
        const firstLine = pre.textContent?.split('\n')[0];
        if (!firstLine) return;
        const charCount = firstLine.length;
        if (charCount === 0) return;

        // Container width is the article content width
        const containerWidth = content.offsetWidth;

        // Monospace char width ratio is ~0.6 of font-size
        // containerWidth = charCount * 0.6 * fontSize + letterSpacing * charCount
        // Solve for fontSize (ignoring letter-spacing for now, it's tiny)
        const fontSize = containerWidth / (charCount * 0.602);
        pre.style.fontSize = `${fontSize}px`;
        pre.style.lineHeight = `${fontSize * 1.35}px`;
      });
    };

    scaleAsciiArt();
    window.addEventListener('resize', scaleAsciiArt);
    return () => window.removeEventListener('resize', scaleAsciiArt);
  }, [annotatedHtml]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    setIsDrawing(true);
    const pt = getCanvasPoint(e);
    currentPathRef.current = [pt];
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode || !isDrawing) return;
    const pt = getCanvasPoint(e);
    currentPathRef.current.push(pt);

    // Live draw
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const points = currentPathRef.current;
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = drawTool === 'eraser' ? 'rgba(255,255,255,1)' : '#000';
    ctx.lineWidth = drawTool === 'eraser' ? 12 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  };

  const handleDrawEnd = () => {
    if (!drawMode || !isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current.length > 1) {
      const newPaths = [...drawPaths, { tool: drawTool, points: currentPathRef.current }];
      setDrawPaths(newPaths);
      // Save to server
      fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, drawingData: JSON.stringify(newPaths) }),
      });
    }
    currentPathRef.current = [];
  };

  const handleClearDrawing = () => {
    setDrawPaths([]);
    fetch('/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, drawingData: JSON.stringify([]) }),
    });
  };

  // Click away to close selection popup
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-popup')) {
        setSelectionPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!article) return null;

  const showAnnotationMargin = !focusMode && annotations.length > 0;

  return (
    <div className={`article-reader-wrapper${panelOpen ? ' panel-open' : ''}${focusMode ? ' focus-mode' : ''}`} ref={wrapperRef}>
      {/* Reading progress bar for focus mode */}
      {focusMode && (
        <div className="reading-progress" style={{ width: `${readingProgress * 100}%` }} />
      )}

      {/* Draw toolbar */}
      {drawMode && (
        <div className="draw-toolbar">
          <button
            className={`draw-tool-btn${drawTool === 'pen' ? ' active' : ''}`}
            onClick={() => setDrawTool('pen')}
          >Pen</button>
          <button
            className={`draw-tool-btn${drawTool === 'eraser' ? ' active' : ''}`}
            onClick={() => setDrawTool('eraser')}
          >Eraser</button>
          <button className="draw-tool-btn" onClick={handleClearDrawing}>Clear</button>
        </div>
      )}

      <div className={`article-reader-with-margin${showAnnotationMargin ? ' has-margin' : ''}`}>
        <div className="article-reader" onMouseUp={handleMouseUp}>
          {!focusMode && (
            <div className="article-top-actions">
              <button className="back-btn" onClick={onBack}>&larr; Back</button>
              <div className="article-action-btns">
                <button
                  className={`save-btn${isSaved ? ' saved' : ''}`}
                  onClick={() => onSave?.(articleId, !isSaved)}
                >
                  {isSaved ? '★ Saved' : '☆ Save'}
                </button>
                <button
                  className={`archive-btn${isArchived ? ' archived' : ''}`}
                  onClick={() => onArchive(articleId, !isArchived)}
                >
                  {isArchived ? '↩ Unarchive' : '↓ Archive'}
                </button>
              </div>
            </div>
          )}

          <h1 className="article-title">{article.title}</h1>
          {!focusMode && (
            <div className="article-meta">
              {article.author && <>{article.author} &middot; </>}
              <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                {article.source}
              </a>
              {article.date_published && <> &middot; {new Date(article.date_published).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</>}
            </div>
          )}

          <div
            className="article-content"
            ref={contentRef}
            dangerouslySetInnerHTML={{ __html: focusMode ? stripImages(annotatedHtml) : annotatedHtml }}
          />

          {/* Canvas overlay for drawing */}
          <canvas
            ref={canvasRef}
            className={`draw-canvas${drawMode ? ' active' : ''}${drawPaths.length > 0 ? ' has-paths' : ''}`}
            onMouseDown={handleDrawStart}
            onMouseMove={handleDrawMove}
            onMouseUp={handleDrawEnd}
            onMouseLeave={handleDrawEnd}
          />

          {/* Selection popup for creating annotations */}
          {selectionPopup && !focusMode && (
            <div
              className="selection-popup"
              style={{ left: selectionPopup.x, top: selectionPopup.y }}
            >
              <button className="selection-popup-btn" onClick={handleCreateAnnotation}>✎</button>
            </div>
          )}

          {!focusMode && article.pdf_path && (
            <a href={`/api/articles/${article.id}/pdf`} className="pdf-btn" download>
              Download PDF
            </a>
          )}

          {!focusMode && articleImages.length > 0 && (
            <div className="images-section">
              <button
                className="references-toggle"
                onClick={() => setImagesOpen(!imagesOpen)}
              >
                {imagesOpen ? '▾' : '▸'} Images ({articleImages.length})
              </button>
              {imagesOpen && (
                <div className="images-gallery">
                  {articleImages.map(img => (
                    <div key={img.id} className="bw-image-item">
                      <img src={img.bw_image_path} alt={img.alt_text || ''} className="bw-image" />
                      {img.alt_text && <div className="bw-image-caption">{img.alt_text}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Annotation margin — notes positioned relative to their highlights */}
        {showAnnotationMargin && (
          <div className="annotation-margin" ref={(el) => {
            // Position each annotation note next to its highlight
            if (!el) return;
            requestAnimationFrame(() => {
              const notes = el.querySelectorAll<HTMLElement>('.annotation-note');
              let lastBottom = 0;
              notes.forEach(noteEl => {
                const annId = noteEl.dataset.annotationId;
                const highlight = document.querySelector<HTMLElement>(`.annotated-highlight[data-annotation-id="${annId}"]`);
                if (highlight) {
                  const marginRect = el.getBoundingClientRect();
                  const highlightRect = highlight.getBoundingClientRect();
                  let targetTop = highlightRect.top - marginRect.top + el.scrollTop;
                  // Prevent overlap with previous note
                  if (targetTop < lastBottom + 8) {
                    targetTop = lastBottom + 8;
                  }
                  noteEl.style.position = 'absolute';
                  noteEl.style.top = `${targetTop}px`;
                  noteEl.style.left = '0';
                  noteEl.style.right = '0';
                  lastBottom = targetTop + noteEl.offsetHeight;
                }
              });
            });
          }}>
            {annotations.map(ann => (
              <div key={ann.id} className="annotation-note" data-annotation-id={ann.id}>
                <div className="annotation-connector" />
                <div className="annotation-highlight-preview">
                  &ldquo;{ann.highlighted_text.slice(0, 50)}{ann.highlighted_text.length > 50 ? '…' : ''}&rdquo;
                </div>
                {editingAnnotation === ann.id ? (
                  <div className="annotation-edit">
                    <textarea
                      className="annotation-textarea"
                      value={editNoteText}
                      onChange={e => setEditNoteText(e.target.value)}
                      placeholder="Write a note..."
                      autoFocus
                    />
                    <div className="annotation-actions">
                      <button className="annotation-save-btn" onClick={() => handleSaveAnnotation(ann.id)}>Save</button>
                      <button className="annotation-cancel-btn" onClick={() => setEditingAnnotation(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="annotation-display">
                    {ann.note_text && <div className="annotation-text">{ann.note_text}</div>}
                    <div className="annotation-actions">
                      <button className="annotation-edit-btn" onClick={() => { setEditingAnnotation(ann.id); setEditNoteText(ann.note_text); }}>Edit</button>
                      <button className="annotation-delete-btn" onClick={() => handleDeleteAnnotation(ann.id)}>&times;</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!focusMode && (
        <>
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
        </>
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripImages(html: string): string {
  // Remove img tags and ascii art containers
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<div class="ascii-art-container">[\s\S]*?<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="ascii-art-container">[\s\S]*?<\/div>/gi, '');
}
