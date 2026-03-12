import { NextRequest, NextResponse } from 'next/server';
import { saveArticle, unsaveArticle } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { articleId, saved } = await request.json();
  if (saved) {
    saveArticle(articleId);
  } else {
    unsaveArticle(articleId);
  }
  return NextResponse.json({ ok: true });
}
