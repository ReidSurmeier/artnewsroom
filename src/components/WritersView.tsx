'use client';

import { useState, useEffect } from 'react';

interface Writer {
  id: number;
  name: string;
  slug: string;
  date_added: string;
  notes: string;
}

export default function WritersView() {
  const [writers, setWriters] = useState<Writer[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    fetch('/api/writers').then(r => r.json()).then(setWriters);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = input.trim();
    if (!name) return;
    setError('');
    const res = await fetch('/api/writers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to add');
      return;
    }
    setInput('');
    load();
  };

  const handleRemove = async (id: number) => {
    await fetch(`/api/writers/${id}`, { method: 'DELETE' });
    load();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="writers-view">
      <h2 className="writers-heading">WRITERS</h2>
      <div className="writers-add">
        <input
          className="writers-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add writer name..."
        />
      </div>
      {error && <div className="writers-error">{error}</div>}
      <ul className="writers-list">
        {writers.map(w => (
          <li key={w.id} className="writers-item">
            <span className="writers-name">{w.name}</span>
            <span className="writers-date">{w.date_added}</span>
            <button className="writers-remove" onClick={() => handleRemove(w.id)}>&times;</button>
          </li>
        ))}
      </ul>
      {writers.length === 0 && (
        <div className="writers-empty">No tracked writers yet.</div>
      )}
    </div>
  );
}
