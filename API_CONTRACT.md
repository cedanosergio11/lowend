# LOWEND V1 Jobs API Contract

Locked field names — do not rename.

## Conventions

| Topic | Rule |
| --- | --- |
| String index | `E=0`, `A=1`, `D=2`, `G=3` |
| ASCII | Always **G top → E bottom** (`G\|` `D\|` `A\|` `E\|`) |
| Frets | Decimal digits |
| Time | Left → right |

Analysis story (honest): band-limit **40–350 Hz** → pitch/onset → fret map (prefer frets **0–12** on ties). No Demucs. No Apple Music. Real DSP later owned by **440Hz**.

## `POST /api/jobs`

Multipart form field: `file` (`wav` \| `mp3` \| `m4a` \| `flac`, ≤ **8 minutes**).

**201**

```json
{ "jobId": "<uuid>", "status": "queued" }
```

| Status | When |
| --- | --- |
| **400** | Empty / corrupt / non-audio |
| **413** | Longer than 8 minutes |

## `GET /api/jobs/:id`

```json
{
  "jobId": "<uuid>",
  "status": "queued | running | done | failed",
  "progress": 0,
  "error": "optional string when failed",
  "result": { "... only when status is done ..." }
}
```

When `status` is `"done"`, `result` is:

```json
{
  "label": "Estimated",
  "tuning": "EADG",
  "sampleRate": 44100,
  "durationMs": 0,
  "notes": [
    {
      "string": 0,
      "fret": 0,
      "tMs": 0,
      "durMs": 0,
      "hz": 41.2,
      "confidence": 0.8
    }
  ],
  "ascii": "G|----\nD|----\nA|----\nE|0---",
  "caveats": ["…"]
}
```

- `notes[].string`: `0–3` (E…G)
- `notes[].fret`: `0–24`
- `notes[].confidence`: `0–1`
- `progress`: `0–1`

## `GET /api/jobs/:id/tab.txt`

Plain-text ASCII download (`Content-Type: text/plain`). Same G→E layout as `result.ascii`.

## V1 stub honesty

- **WAV**: decoded in Node (PCM); energy onset + autocorrelation pitch in the bass band.
- **mp3 / m4a / flac**: accepted + duration stubbed from size; notes may be placeholders with caveat **`stub notes — not real pitch detection yet`**.
- Job store is **in-memory** (lost on restart).

See also README § Jobs API.

## Hosting note

GitHub Pages serves the studio UI only. These endpoints require a Node/TanStack Start server (`npm run dev`).
