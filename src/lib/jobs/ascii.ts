import type { JobNote } from "./types";

/** ASCII display order: G top → E bottom (visual neck). */
const ASCII_ROWS: Array<{ label: "G" | "D" | "A" | "E"; string: 0 | 1 | 2 | 3 }> = [
  { label: "G", string: 3 },
  { label: "D", string: 2 },
  { label: "A", string: 1 },
  { label: "E", string: 0 },
];

/**
 * Render ASCII tab: G| … D| … A| … E|
 * Frets as decimal digits, time left→right.
 * Columns are ~50ms buckets so notes align roughly in time.
 */
export function renderAscii(
  notes: JobNote[],
  durationMs: number,
  opts?: { colMs?: number },
): string {
  const colMs = opts?.colMs ?? 50;
  const cols = Math.max(1, Math.ceil(Math.max(durationMs, 1) / colMs));
  const grid: string[][] = ASCII_ROWS.map(() => Array.from({ length: cols }, () => "-"));

  const sorted = [...notes].sort((a, b) => a.tMs - b.tMs || a.string - b.string);
  for (const n of sorted) {
    const rowIdx = ASCII_ROWS.findIndex((r) => r.string === n.string);
    if (rowIdx < 0) continue;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(n.tMs / colMs)));
    const fretStr = String(Math.max(0, Math.min(24, Math.round(n.fret))));
    // Place multi-digit frets spanning columns when needed
    for (let i = 0; i < fretStr.length; i++) {
      const c = col + i;
      if (c >= cols) break;
      grid[rowIdx]![c] = fretStr[i]!;
    }
  }

  return ASCII_ROWS.map((r, i) => `${r.label}|${grid[i]!.join("")}`).join("\n");
}
