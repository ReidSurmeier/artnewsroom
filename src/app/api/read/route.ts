import { NextRequest, NextResponse } from 'next/server';
import { markAsRead } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { articleId } = await request.json();
  if (!articleId) {
    return NextResponse.json({ error: 'articleId required' }, { status: 400 });
  }
  markAsRead(articleId);
  return NextResponse.json({ ok: true });
}
