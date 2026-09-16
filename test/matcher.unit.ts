/**
 * Unit tests for the pure matching engine.
 * Run with: npm run test:unit  (Node >= 23.6 type stripping)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIndex,
  extractIssns,
  issnChecksumOk,
  matchJournal,
  normalizeTitle,
} from "../src/modules/matcher.ts";
import type { CatalogEntry } from "../src/modules/types.ts";
import { catalogJournals } from "../src/data/catalog.ts";

const sample: CatalogEntry[] = [
  { name: "CELL", issn: "0092-8674", category: "T1", isReview: false },
  {
    name: "JAMA-JOURNAL OF THE AMERICAN MEDICAL ASSOCIATION",
    issn: "0098-7484",
    category: "T1",
    isReview: false,
  },
  {
    name: "JAMA ONCOLOGY",
    issn: "2374-2437",
    category: "T2(A)",
    isReview: false,
  },
  {
    name: "SPACE WEATHER-THE INTERNATIONAL JOURNAL OF RESEARCH AND APPLICATIONS",
    issn: "1542-7390",
    category: "Q2",
    isReview: false,
  },
  { name: "SCIENCE", issn: "0036-8075", category: "T1", isReview: false },
  {
    name: "ALZHEIMERS & DEMENTIA",
    issn: "1552-5260",
    category: "T3(A)",
    isReview: false,
  },
  {
    name: "NATURE REVIEWS DRUG DISCOVERY",
    issn: "1474-1776",
    category: "T2(B)",
    isReview: true,
  },
  {
    name: "HEAD AND NECK-JOURNAL FOR THE SCIENCES AND SPECIALTIES OF THE HEAD AND NECK",
    issn: "1043-3074",
    category: "Q2",
    isReview: false,
  },
  {
    // shares the {SPACE, WEATHER} token set with the entry above
    name: "JOURNAL OF SPACE WEATHER AND SPACE CLIMATE",
    issn: "1364-6826",
    category: "Q1",
    isReview: false,
  },
  {
    name: "BRAIN BEHAVIOR AND IMMUNITY",
    issn: "0889-1591",
    category: "Q1",
    isReview: false,
  },
];

const index = buildIndex(sample);

test("issnChecksumOk", () => {
  assert.equal(issnChecksumOk("00928674"), true);
  assert.equal(issnChecksumOk("00928675"), false);
  assert.equal(issnChecksumOk("14741776"), true); // X check digit not needed here
  assert.equal(issnChecksumOk("1234567X"), false); // bad checksum
  assert.equal(issnChecksumOk("00393740"), false); // valid prefix, wrong check digit
});

test("extractIssns: valid, invalid and duplicates", () => {
  assert.deepEqual(extractIssns("0092-8674"), ["00928674"]);
  assert.deepEqual(extractIssns("0092-8674, 0092-8674"), ["00928674"]);
  assert.deepEqual(extractIssns("0092-8675"), []); // bad checksum
  assert.deepEqual(extractIssns("ISSN: 0092-8674 (print) 1234-5678"), [
    "00928674",
  ]);
  assert.deepEqual(extractIssns(""), []);
  assert.deepEqual(extractIssns(null), []);
});

test("normalizeTitle", () => {
  assert.equal(normalizeTitle("The Lancet"), "LANCET");
  assert.equal(
    normalizeTitle("Alzheimer's & Dementia"),
    "ALZHEIMERS AND DEMENTIA",
  );
  assert.equal(
    normalizeTitle("Fortschritte der Physik – Progress of Physics"),
    "FORTSCHRITTE DER PHYSIK PROGRESS OF PHYSICS",
  );
  assert.equal(
    normalizeTitle("OTOLARYNGOLOGY-HEAD AND NECK SURGERY"),
    "OTOLARYNGOLOGY HEAD AND NECK SURGERY",
  );
});

test("match by ISSN", () => {
  const m = matchJournal({ issn: "0092-8674" }, index);
  assert.equal(m?.entry.name, "CELL");
  assert.equal(m?.via, "issn");
});

test("match by normalized title (THE dropped, apostrophes)", () => {
  const a = matchJournal({ title: "Alzheimer's & Dementia" }, index);
  assert.equal(a?.entry.name, "ALZHEIMERS & DEMENTIA");
  assert.equal(a?.via, "title");
});

test("match by token subset (short publisher title)", () => {
  const m = matchJournal({ title: "Space Weather" }, index);
  assert.equal(m?.via, "title-prefix"); // two candidates, prefix tie-break
  assert.equal(m?.entry.category, "Q2");

  const h = matchJournal({ title: "Head & Neck" }, index);
  assert.equal(h?.via, "title-tokens");
  assert.equal(h?.entry.issn, "1043-3074");
});

test("prefix tie-break requires >= 2 tokens (single generic word is rejected)", () => {
  // "BRAIN" would prefix-match "BRAIN BEHAVIOR AND IMMUNITY", but a one-token
  // title is too weak a signal and must not be matched
  assert.equal(matchJournal({ title: "Brain" }, index), undefined);
});

test("ambiguous short title is rejected", () => {
  // "JAMA" is a subset of both JAMA-JOURNAL... and JAMA ONCOLOGY and the
  // prefix tie-break requires >= 2 tokens
  assert.equal(matchJournal({ title: "JAMA" }, index), undefined);
});

test("no false positive for longer titles", () => {
  assert.equal(matchJournal({ title: "Science Advances" }, index), undefined);
  assert.equal(matchJournal({ title: "Gut Microbes" }, index), undefined);
});

test("abbreviations are not matched (documented limitation)", () => {
  assert.equal(matchJournal({ title: "EJSO" }, index), undefined);
});

test("unknown journal is unmatched", () => {
  assert.equal(
    matchJournal({ title: "Some Random Journal" }, index),
    undefined,
  );
});

test("real catalog: integrity", () => {
  assert.equal(catalogJournals.length, 2965);
  const byIssnReal = buildIndex(catalogJournals);
  const cell = matchJournal({ issn: "0092-8674", title: "Cell" }, byIssnReal);
  assert.equal(cell?.entry.category, "T1");
  const lancet = matchJournal(
    { title: "The Lancet", issn: "0140-6736" },
    byIssnReal,
  );
  assert.equal(lancet?.entry.category, "T1");
  const nrdd = matchJournal(
    { title: "Nature Reviews Drug Discovery", issn: "1474-1776" },
    byIssnReal,
  );
  assert.equal(nrdd?.entry.isReview, true);
  assert.equal(nrdd?.entry.category, "T2(B)");
  // JAMA without ISSN must be ambiguous in the real catalog too
  assert.equal(matchJournal({ title: "JAMA" }, byIssnReal), undefined);
  // "Space Weather" (no ISSN) resolves via the prefix tie-break against the
  // real catalog, where two entries share the {SPACE, WEATHER} token set
  const sw = matchJournal({ title: "Space Weather" }, byIssnReal);
  assert.equal(sw?.via, "title-prefix");
  assert.equal(sw?.entry.category, "Q1");
  // ISSN of BJOG entry resolves even without title
  const bjog = matchJournal({ issn: "1470-0328" }, byIssnReal);
  assert.ok(bjog);
});

test("real catalog: every entry is findable by its own ISSN/name", () => {
  const byIssnReal = buildIndex(catalogJournals);
  let failures = 0;
  for (const entry of catalogJournals) {
    const byissn = matchJournal({ issn: entry.issn }, byIssnReal);
    if (!byissn || byissn.entry.issn !== entry.issn) failures++;
  }
  assert.equal(failures, 0);
});
