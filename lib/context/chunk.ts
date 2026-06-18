/**
 * Splits raw context text into retrievable chunks.
 *
 * Packs whole paragraphs up to ~maxChars, carrying a small overlap between
 * chunks so retrieval doesn't lose context at boundaries. Paragraphs longer
 * than maxChars are hard-split. Deterministic and dependency-free.
 */
export function chunkText(
  input: string,
  opts: { maxChars?: number; overlap?: number } = {},
): string[] {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = opts.overlap ?? 150;

  const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flush();
      for (const piece of hardSplit(para, maxChars, overlap)) chunks.push(piece);
      continue;
    }
    if (current && current.length + para.length + 2 > maxChars) {
      flush();
      const prev = chunks[chunks.length - 1] ?? "";
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      current = tail ? `${tail}\n\n${para}` : para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  flush();

  return chunks;
}

function hardSplit(text: string, maxChars: number, overlap: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    const piece = text.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    i = Math.max(0, end - overlap);
  }
  return out;
}
