import { NextResponse } from 'next/server';
import { getWriters, addWriter } from '@/lib/db';

export async function GET() {
  return NextResponse.json(getWriters());
}

export async function POST(req: Request) {
  const { name, notes } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  try {
    addWriter(name.trim(), notes || '');
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
