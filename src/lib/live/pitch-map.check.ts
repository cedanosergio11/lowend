// Run: npx tsx src/lib/live/pitch-map.check.ts
import assert from "node:assert/strict";
import { mapHz } from "./pitch-map";
import { FLAT_NAMES } from "../bass/spelling";

const STANDARD = [43, 38, 33, 28];
const EB = [42, 37, 32, 27];

const e1 = mapHz(41.2, STANDARD, FLAT_NAMES)!;
assert.equal(e1.midi, 28);
assert.equal(`${e1.name}${e1.octave}`, "E1");
assert.ok(Math.abs(e1.cents) < 1, `cents ${e1.cents}`);
assert.deepEqual(e1.position, { string: 3, fret: 0 });

const eb1 = mapHz(38.89, STANDARD, FLAT_NAMES)!;
assert.equal(`${eb1.name}${eb1.octave}`, "E♭1");
assert.equal(eb1.position, null); // below standard low E

const ebTuned = mapHz(41.2, EB, FLAT_NAMES)!;
assert.deepEqual(ebTuned.position, { string: 3, fret: 1 });
assert.deepEqual(mapHz(38.89, EB, FLAT_NAMES)!.position, { string: 3, fret: 0 });

// Nearest-position: A2 (110 Hz) after D-string fret 6 → D fret 7, not G fret 2.
assert.deepEqual(mapHz(110, STANDARD, FLAT_NAMES, { string: 1, fret: 6 })!.position, { string: 1, fret: 7 });
assert.deepEqual(mapHz(55, STANDARD, FLAT_NAMES, null)!.position, { string: 2, fret: 0 });
assert.ok(mapHz(41.2 * Math.pow(2, 20 / 1200), STANDARD, FLAT_NAMES)!.cents > 19);

console.log("pitch-map checks: all passed");
