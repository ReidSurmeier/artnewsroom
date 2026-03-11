import { NextRequest, NextResponse } from 'next/server';
import { getArticles, getArchivedArticles, searchArticles } from '@/lib/db';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const archived = request.nextUrl.searchParams.get('archived');

  if (search) {
    return NextResponse.json(searchArticles(search));
  }

  if (archived === 'true') {
    return NextResponse.json(getArchivedArticles());
  }

  return NextResponse.json(getArticles());
}
