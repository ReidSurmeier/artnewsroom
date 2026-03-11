import { NextRequest, NextResponse } from 'next/server';
import { getDrawing, saveDrawing } from '@/lib/db';

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId');
  if (!articleId) return NextResponse.json(null);
  const drawing = getDrawing(articleId);
  return NextResponse.json(drawing || null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { articleId, drawingData } = body;
  if (!articleId || !drawingData) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  saveDrawing(articleId, drawingData);
  return NextResponse.json({ ok: true });
}
