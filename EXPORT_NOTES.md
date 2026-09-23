# LOWEND export notes

## Origin

- Grok workspace / project ID: `037d06a6-6e0f-48d1-816e-bb0070f778dd` (name: **LOWEND**)
- Conversation: `9d7f7161-e032-47e6-9262-c4808bf2b49f` — **LOWEND Bass Studio App** (2026-08-27 CT)
- No project-level Files tab attachments; source lived in the Grok Build sandbox file tree
- Grok REST `GET /rest/app-chat/conversations/{id}/responses` used to recover EditFile payloads (SSO cookie from box Chrome profile)

## What landed

App-specific source under `src/components/studio/*`, `src/lib/bass/*`, routes, styles, startup.sh — reconstructed from conversation tool cards.

Scaffold (Vite/TanStack/auth stubs/scripts/public) copied from Sergio’s existing Grok-style `process-flow-sim` tree so the package is runnable-looking.

## Truncation / completion

Grok’s conversation API truncates large `EditFile` `newString` payloads at ~4100 characters (`…` suffix). These files were completed on the box from the recovered prefixes + the known import surface (not re-invented audio analysis):

- `src/lib/bass/audio.ts`
- `src/components/studio/amp-rack.tsx`
- `src/components/studio/groove-deck.tsx`
- `src/components/studio/studio.tsx`
- `src/components/studio/fretboard.tsx`

Smaller files (theory, grooves, store, mark, scale-rail, button, routes, styles) recovered intact.

## Missing vs Grok sandbox

- Exact final sandbox bytes for the five truncated files (completed here)
- Screenshots under `/workspace/screenshots/*`
- Brand OG assets from the SubAgent pass (favicon/og may be scaffold defaults)
- Published `*.grok.me` slug (none found for LOWEND; `lowend.grok.me` 404)
- Song-upload → tab estimation pipeline (product vision only; **440Hz** owns that story)
- Full `node_modules` / lockfile from the Build environment

## Not invented

No Demucs, no stem separation, no ML tab estimator. Audio is Web Audio synthesis as in the Grok studio thread.

## Scaffold completeness (box)

Copied remaining Grok template auth/db/PWA scripts from `process-flow-sim` so `vite.config.ts` and `auth/client.ts` resolve: `sign-out-plan`, `grok-pwa-*`, `migration-plan`, `write-atomic`, `db.ts`, auth server modules (`server`, `popup`, `verify`, `isolation`, `gate-*`, `pglite-dialect`). Favicon/OG still scaffold defaults.
