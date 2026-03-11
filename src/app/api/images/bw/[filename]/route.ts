import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  // Prevent directory traversal
  const safe = path.basename(filename);
  const filePath = path.join(process.cwd(), 'data', 'images', 'bw', safe);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}
