import { NextResponse } from 'next/server';
import { getArticleImages } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get('articleId');
  if (!articleId) return NextResponse.json([]);
  return NextResponse.json(getArticleImages(articleId));
}
