import { NextRequest, NextResponse } from 'next/server';
import { getArticles, searchArticles } from '@/lib/db';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const articles = search ? searchArticles(search) : getArticles();
  return NextResponse.json(articles);
}
