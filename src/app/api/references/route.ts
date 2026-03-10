import { NextResponse } from 'next/server';
import { getReferences } from '@/lib/db';

export async function GET() {
  const refs = getReferences();
  return NextResponse.json(refs);
}
