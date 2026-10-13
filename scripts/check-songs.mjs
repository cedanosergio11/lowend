// Self-test for src/lib/bass/songs.ts (no test runner in repo). Run: node scripts/check-songs.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const dir = mkdtempSync(join(tmpdir(), "songs-"));
for (const name of ["theory", "songs", "song-playback"]) {
  const src = readFileSync(new URL(`../src/lib/bass/${name}.ts`, import.meta.url), "utf8");
  const js = ts
    .transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/from "\.\/(theory|songs)"/g, 'from "./$1.mjs"');
  writeFileSync(join(dir, `${name}.mjs`), js);
}
const { SONGS, parseAsciiBars, toStandardTuning, songPresets } = await import(join(dir, "songs.mjs"));
const { songToEvents, cursorAt } = await import(join(dir, "song-playback.mjs"));

const song = SONGS.find((s) => s.id === "pista-1");
assert.ok(song);
const sec = (id) => song.sections.find((s) => s.id === id);
const expectBars = { verse: 2, fill: 1, pre: 2, "g-hold": 2, chorus: 1 };
for (const s of song.sections) {
  assert.equal(s.bars.length, expectBars[s.id], s.id);
  assert.deepEqual(parseAsciiBars(s.ascii), s.bars);
  for (const bar of s.bars) for (const k of ["G", "D", "A", "E"]) assert.equal(bar[k].length, 8, `${s.id} ${k}`);
}
const vb = sec("verse").bars[0];
assert.deepEqual(vb.D.slice(0, 2), [{ fret: 3 }, { fret: 1 }]);
assert.deepEqual(vb.E.slice(2).map((c) => c.fret), [4, 4, 2, 2, 4, 1]);
const ch = sec("chorus").bars[0];
assert.deepEqual(ch.E.slice(2, 6), [{ fret: 0 }, { fret: 0 }, { fret: 0 }, { fret: 0 }]);
for (const c of ch.E.slice(2, 6)) assert.deepEqual(toStandardTuning(c), { fret: null, unplayable: true });
assert.deepEqual(toStandardTuning({ fret: 4 }), { fret: 3 });
assert.equal(toStandardTuning(null), null);
assert.deepEqual(toStandardTuning({ hold: true }), { hold: true });
assert.ok(sec("chorus").notes.some((n) => /vary per pass/.test(n)));
const hold = sec("g-hold").bars[1].E;
assert.equal(hold.filter((c) => c && "fret" in c).length, 1);
assert.equal(hold.filter((c) => c && "hold" in c).length, 7);
assert.deepEqual(songPresets(song), { bpm: 96, root: "G", rootPc: 7, scale: "minor", tuningId: "eb" });
const f = song.form;
assert.deepEqual(f.map((p) => p.name), ["Intro", "Part 1", "Part 2", "Part 3", "Part 4"]);
assert.deepEqual(f[0].steps, [{ sectionId: "intro", bars: 2, note: "no bass" }]);
const riffs = [10, 4, 6, 4];
for (let i = 1; i <= 4; i++) {
  const st = f[i].steps;
  assert.deepEqual(st[0], { sectionId: "verse", times: riffs[i - 1] - 1 });
  assert.equal(st[1].sectionId, "verse"); assert.equal(st[1].bars, 1); assert.equal(st[1].times, 1);
  assert.deepEqual(st[2], { sectionId: "fill", times: 1, bars: 1 });
  assert.deepEqual(st[3], { sectionId: "pre", times: 3 });
}
const ids = (i) => f[i].steps.slice(4).map((s) => s.sectionId);
assert.deepEqual(ids(1), ["g-hold"]);
assert.deepEqual(ids(2), ["g-hold", "chorus"]);
assert.deepEqual(ids(3), ["g-hold", "chorus", "g-hold"]);
assert.deepEqual(ids(4), ["g-hold", "chorus", "end"]);
const holds = f.flatMap((p) => p.steps).filter((s) => s.sectionId === "g-hold");
assert.deepEqual(holds.map((s) => s.bars), [4, 1, 1, 4, 1]);
for (const h of holds.filter((s) => s.bars === 4)) assert.equal(h.note, "3-4 bars, estimated");
for (const p of f.slice(2)) assert.equal(p.steps[4].bars, 1);
assert.ok(song.form.flatMap((p) => p.steps).filter((s) => s.sectionId === "chorus").every((s) => s.times === 8));
// ---- playback ----
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const V = songToEvents(song, { sectionId: "verse" });
near(V.eighthSec, 0.3125);
assert.equal(V.totalEighths, 16);
assert.deepEqual(
  { ...V.events[0] },
  { startEighth: 0, durationEighths: 1, startSec: 0, durationSec: 0.3125, midi: 40, string: "D", fret: 3, sectionId: "verse", barIndex: 0, cellIndex: 0 },
);
assert.equal(V.events[1].midi, 38); near(V.events[1].startSec, 0.3125);
assert.equal(V.events[2].midi, 31); assert.equal(V.events[2].string, "E");
assert.equal(V.events.length, 12);
const GH = songToEvents(song, { sectionId: "g-hold" });
const b2 = GH.events.filter((e) => e.barIndex === 1);
assert.equal(b2.length, 1);
assert.deepEqual([b2[0].midi, b2[0].startEighth, b2[0].durationEighths], [31, 8, 8]);
near(b2[0].durationSec, 2.5);
const C = songToEvents(song, { sectionId: "chorus" });
const ped = C.events.filter((e) => e.cellIndex >= 2 && e.cellIndex <= 5);
assert.equal(ped.length, 4);
for (const e of ped) assert.equal(e.midi, 27);
assert.deepEqual(C.events.map((e) => e.midi), [36, 34, 27, 27, 27, 27, 31, 32]);
const C2 = songToEvents(song, { sectionId: "chorus", speed: 0.5 });
near(C2.totalSeconds, C.totalSeconds * 2); near(C2.events[0].durationSec, C.events[0].durationSec * 2);
near(songToEvents(song, { sectionId: "chorus", bpm: 120 }).eighthSec, 0.25);
// full form: intro 16 + P1 (160+48+32) + P2 (64+48+8+64) + P3 (96+48+8+64+32) + P4 (64+48+8+64) = 872
const F = songToEvents(song);
assert.equal(F.totalEighths, 872);
near(F.totalSeconds, 272.5);
assert.equal(F.events[0].startEighth, 16); // 2 bars of intro silence
const longHolds = F.events.filter((e) => e.sectionId === "g-hold" && e.durationEighths === 8 * 3);
assert.equal(longHolds.length, 2); // bar 2 G + 2 sustain bars, twice
for (let i = 1; i < F.events.length; i++) assert.ok(F.events[i].startEighth >= F.events[i - 1].startEighth);
// cursor
assert.equal(cursorAt(V, -0.001), null);
assert.equal(cursorAt(V, NaN), null);
assert.deepEqual(cursorAt(V, 0), { sectionId: "verse", barIndex: 0, cellIndex: 0 });
assert.deepEqual(cursorAt(V, 0.3125), { sectionId: "verse", barIndex: 0, cellIndex: 1 });
assert.deepEqual(cursorAt(V, 2.5 - 1e-6), { sectionId: "verse", barIndex: 0, cellIndex: 7 });
assert.deepEqual(cursorAt(V, 2.5), { sectionId: "verse", barIndex: 1, cellIndex: 0 });
assert.deepEqual(cursorAt(V, V.totalSeconds - 1e-6), { sectionId: "verse", barIndex: 1, cellIndex: 7 });
assert.equal(cursorAt(V, V.totalSeconds), null);
assert.deepEqual(cursorAt(F, 0), { sectionId: "intro", barIndex: 0, cellIndex: 0 });
assert.deepEqual(cursorAt(F, 5), { sectionId: "verse", barIndex: 0, cellIndex: 0 });
assert.deepEqual(cursorAt(F, F.totalSeconds - 1e-6), { sectionId: "chorus", barIndex: 0, cellIndex: 7 });
console.log("check-songs: all assertions passed");
