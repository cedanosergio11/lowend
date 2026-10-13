// Self-test for src/lib/bass/songs.ts (no test runner in repo). Run: node scripts/check-songs.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/bass/songs.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), "songs-")), "songs.mjs");
writeFileSync(file, js);
const { SONGS, parseAsciiBars, toStandardTuning, songPresets } = await import(file);

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
console.log("check-songs: all assertions passed");
