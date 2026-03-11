import { NextRequest, NextResponse } from 'next/server';
import { archiveArticle, unarchiveArticle } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { articleId, archived } = await request.json();
  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 });
  }

  if (archived) {
    archiveArticle(articleId);
  } else {
    unarchiveArticle(articleId);
  }

  return NextResponse.json({ ok: true });
}
