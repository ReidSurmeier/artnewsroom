import { NextRequest, NextResponse } from 'next/server';
import { getArticle } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const article = getArticle(id);
  if (!article) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!article.pdf_path) {
    return NextResponse.json({ error: 'No PDF available' }, { status: 404 });
  }

  const pdfFullPath = path.join(process.cwd(), article.pdf_path);
  if (!fs.existsSync(pdfFullPath)) {
    return NextResponse.json({ error: 'PDF file missing' }, { status: 404 });
  }

  const pdfBuffer = fs.readFileSync(pdfFullPath);
  const slug = article.title
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 60);

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}.pdf"`,
    },
  });
}
