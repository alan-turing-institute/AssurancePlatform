import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export function GET() {
  // Read files from the file system using Node.js fs module
  const templatesDir = path.resolve(process.cwd(), 'caseTemplates');
  const files = fs.readdirSync(templatesDir);

  // Filter JSON files
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  // Read JSON content and parse it
  const newTemplates = jsonFiles.map((file) => {
    const filePath = path.join(templatesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  });

  // Find default case
  const defaultCase =
    newTemplates.find((c) => c.name === 'empty') || newTemplates[0];

  return NextResponse.json({ newTemplates, defaultCase });
}
