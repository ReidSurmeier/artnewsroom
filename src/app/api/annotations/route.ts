import { NextRequest, NextResponse } from 'next/server';
import { getAnnotations, addAnnotation, updateAnnotation, deleteAnnotation } from '@/lib/db';

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId');
  if (!articleId) return NextResponse.json([]);
  const annotations = getAnnotations(articleId);
  return NextResponse.json(annotations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { article_id, highlighted_text, note_text, start_offset, end_offset } = body;
  if (!article_id || !highlighted_text || start_offset == null || end_offset == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const id = addAnnotation({ article_id, highlighted_text, note_text: note_text || '', start_offset, end_offset });
  return NextResponse.json({ id });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, note_text } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  updateAnnotation(id, note_text || '');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  deleteAnnotation(Number(id));
  return NextResponse.json({ ok: true });
}
