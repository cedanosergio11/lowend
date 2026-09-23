# LOWEND

Playable four-string bass studio: fretboard, scales, grooves, and a Web Audio amp.

**Product vision (channel):** upload a song → estimated bass tabs. V1 ships an honest server jobs API (see `API_CONTRACT.md`). This repo also has the Grok Build **bass studio** recovered from the LOWEND project.

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

## Jobs API (V1 server analysis)

Upload audio → estimated bass tab JSON + ASCII. Contract: [`API_CONTRACT.md`](./API_CONTRACT.md).

```bash
# create job
curl -sS -F file=@song.wav http://127.0.0.1:8080/api/jobs

# poll
curl -sS http://127.0.0.1:8080/api/jobs/<jobId>

# ASCII download
curl -sS http://127.0.0.1:8080/api/jobs/<jobId>/tab.txt
```

**Server analysis limits:** PCM WAV is decoded in Node and analyzed from the mixed audio with a 40–350 Hz band-limit, energy onset, autocorrelation pitch, and EADG fret mapping. Results are **Estimated**, not official tabs, and no stem separation is performed. mp3/m4a/flac are accepted, but the Node path cannot decode them in V1: duration is estimated from file size and returned notes are illustrative only, not pitch detections.

## GitHub Pages vs Jobs API

**Pages** (`https://cedanosergio11.github.io/lowend/`) is a **static SPA** of the playable bass studio. It does **not** run `POST /api/jobs` (no Node server on Pages).

Upload → estimated tabs needs `npm run dev` (or any server deploy). Contract: [`API_CONTRACT.md`](./API_CONTRACT.md).

## Source

Recovered from Grok project `https://grok.com/project/037d06a6-6e0f-48d1-816e-bb0070f778dd` (conversation **LOWEND Bass Studio App**). See `EXPORT_NOTES.md` for gaps.
