import { NextRequest, NextResponse } from 'next/server';
import { saveNotes } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { articleId, notes } = await request.json();
  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 });
  }
  saveNotes(articleId, notes || '');
  return NextResponse.json({ ok: true });
}
