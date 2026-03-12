import { NextRequest, NextResponse } from 'next/server';
import { getArticles, getArchivedArticles, getSavedArticles, searchArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const archived = request.nextUrl.searchParams.get('archived');
  const saved = request.nextUrl.searchParams.get('saved');

  let data;
  if (search) {
    data = searchArticles(search);
  } else if (saved === 'true') {
    data = getSavedArticles();
  } else if (archived === 'true') {
    data = getArchivedArticles();
  } else {
    data = getArticles();
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
