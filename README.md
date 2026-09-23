# LOWEND

Playable four-string bass studio: fretboard, scales, grooves, and a Web Audio amp.

**Product vision (channel):** upload a song → estimated bass tabs. V1 ships an honest **jobs API stub** (see `API_CONTRACT.md`); real DSP is owned by **440Hz**. This repo also has the Grok Build **bass studio** recovered from the LOWEND project.

Live link: https://cedanosergio11.github.io/lowend/ (GitHub Pages — bass studio UI)

## Stack

- React 19 + TypeScript + Vite
- TanStack Router
- Tailwind CSS v4
- Zustand
- Web Audio API (synthesized bass — no Demucs / stem separation)

## Dev

```bash
npm install
npm run dev
```

## Jobs API (V1 stub)

Upload audio → estimated bass tab JSON + ASCII. Contract: [`API_CONTRACT.md`](./API_CONTRACT.md).

```bash
# create job
curl -sS -F file=@song.wav http://127.0.0.1:8080/api/jobs

# poll
curl -sS http://127.0.0.1:8080/api/jobs/<jobId>

# ASCII download
curl -sS http://127.0.0.1:8080/api/jobs/<jobId>/tab.txt
```

**Real vs stubbed:** WAV decode + band-limit onset/pitch stub is real enough to exercise the shape; mp3/m4a/flac skip decode and may return labeled placeholder notes. Full DSP is owned by **440Hz**.

## GitHub Pages vs Jobs API

**Pages** (`https://cedanosergio11.github.io/lowend/`) is a **static SPA** of the playable bass studio. It does **not** run `POST /api/jobs` (no Node server on Pages).

Upload → estimated tabs needs `npm run dev` (or any server deploy). Contract: [`API_CONTRACT.md`](./API_CONTRACT.md).

## Source

Recovered from Grok project `https://grok.com/project/037d06a6-6e0f-48d1-816e-bb0070f778dd` (conversation **LOWEND Bass Studio App**). See `EXPORT_NOTES.md` for gaps.
