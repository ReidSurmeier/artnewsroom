import { NextResponse } from 'next/server';
import { removeWriter } from '@/lib/db';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  removeWriter(Number(id));
  return NextResponse.json({ ok: true });
}
