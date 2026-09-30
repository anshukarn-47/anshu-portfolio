/**
 * Splits a document into overlapping chunks on paragraph boundaries.
 * Each chunk is prefixed with the document title so it stays meaningful on its
 * own, both for embedding and when shown to the model as context.
 */
const MAX_CHARS = 1800; // ~450 tokens
const OVERLAP_CHARS = 300;

export function chunkDocument(title: string, content: string): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(splitLong);

  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const p of paragraphs) {
    if (length + p.length > MAX_CHARS && current.length) {
      chunks.push(current.join("\n\n"));
      // Carry ~OVERLAP_CHARS of trailing text into the next chunk for continuity:
      // whole paragraphs when they fit, otherwise the tail of the last one.
      const carry: string[] = [];
      let carryLength = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        if (carryLength + current[i].length <= OVERLAP_CHARS) {
          carry.unshift(current[i]);
          carryLength += current[i].length;
          continue;
        }
        if (!carry.length) {
          const tail = tailAtWord(current[i], OVERLAP_CHARS);
          carry.unshift(tail);
          carryLength = tail.length;
        }
        break;
      }
      // Skip the overlap when it wouldn't leave room for the next paragraph.
      const fits = carryLength + p.length <= MAX_CHARS;
      current = fits ? carry : [];
      length = fits ? carryLength : 0;
    }
    current.push(p);
    length += p.length;
  }
  if (current.length) chunks.push(current.join("\n\n"));

  return chunks.map((c) => `${title}\n\n${c}`);
}

/** The last ~`max` characters of `text`, starting at a word boundary. */
function tailAtWord(text: string, max: number): string {
  const tail = text.slice(-max);
  const space = tail.indexOf(" ");
  return (space > 0 && space < max / 2 ? tail.slice(space + 1) : tail).trim();
}

/**
 * Hard-splits a paragraph that can't fit in one chunk, on sentence then word
 * boundaries. Pieces leave room for the carried overlap, so no chunk exceeds MAX_CHARS.
 */
function splitLong(paragraph: string): string[] {
  const size = MAX_CHARS - OVERLAP_CHARS;
  if (paragraph.length <= MAX_CHARS) return [paragraph];
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const at = cut > size / 2 ? cut + 1 : size;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
