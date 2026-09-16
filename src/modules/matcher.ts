/**
 * Pure matching engine (no Zotero dependencies, unit-testable with Node).
 *
 * Matching strategy, in order:
 *  1. ISSN exact match (validated mod-11 checksum, print/electronic equivalent)
 *  2. Normalized journal title exact match
 *  3. Token-subset match (multi-word item titles only): the item's title
 *     tokens are a *proper subset* of a catalog title's tokens (e.g.
 *     "Space Weather" vs
 *     "SPACE WEATHER-THE INTERNATIONAL JOURNAL OF RESEARCH AND APPLICATIONS").
 *     If several catalog entries qualify, a prefix tie-break resolves the
 *     ambiguity: the item's token sequence must be a prefix of exactly one
 *     catalog title.
 *
 * Deliberately conservative: single generic words are never subset-matched,
 * an item with extra tokens beyond the catalog name is NOT matched (prevents
 * "Science Advances" matching "SCIENCE"), and abbreviations are not resolved
 * (e.g. "EJSO").
 */
import type { CatalogEntry, ItemJournalFields, MatchInfo } from "./types";

const ISSN_RE = /(\d{4})-?(\d{3}[\dXx])/g;

/** Validate the mod-11 checksum of an 8-character ISSN (no hyphen). */
export function issnChecksumOk(issn8: string): boolean {
  if (!/^\d{7}[\dX]$/.test(issn8)) return false;
  let total = 0;
  for (let i = 0; i < 7; i++) total += Number(issn8[i]) * (8 - i);
  const check = (11 - (total % 11)) % 11;
  const expected = check === 10 ? "X" : String(check);
  return expected === issn8[7];
}

/**
 * Extract all checksum-valid ISSNs from a raw field value and normalize them
 * to the 8-character form (e.g. "0092-8674" -> "00928674").
 */
export function extractIssns(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  ISSN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ISSN_RE.exec(raw))) {
    const value = (m[1] + m[2]).toUpperCase();
    if (issnChecksumOk(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Normalize a journal title for comparison:
 * NFKD -> strip diacritics -> uppercase -> "&" -> "AND" -> drop apostrophes
 * -> punctuation to spaces -> collapse -> drop leading "THE ".
 */
export function normalizeTitle(raw: string | null | undefined): string {
  if (!raw) return "";
  let t = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  t = t.toUpperCase().replace(/&/g, " AND ");
  t = t.replace(/[\u2018\u2019\u02bc'`´]/g, "");
  t = t.replace(/[^A-Z0-9]+/g, " ").trim();
  if (t.startsWith("THE ")) t = t.slice(4);
  return t;
}

function tokens(normalizedTitle: string): string[] {
  return normalizedTitle.split(" ").filter(Boolean);
}

interface IndexedEntry {
  entry: CatalogEntry;
  tokens: Set<string>;
  tokenList: string[];
}

export interface LookupIndex {
  byIssn: Map<string, CatalogEntry>;
  byTitle: Map<string, CatalogEntry>;
  entries: IndexedEntry[];
}

/** Build lookup structures for a list of catalog entries. */
export function buildIndex(entries: CatalogEntry[]): LookupIndex {
  const byIssn = new Map<string, CatalogEntry>();
  const byTitle = new Map<string, CatalogEntry>();
  const indexed: IndexedEntry[] = [];
  for (const entry of entries) {
    for (const issn of extractIssns(entry.issn)) {
      if (!byIssn.has(issn)) byIssn.set(issn, entry);
    }
    const nt = normalizeTitle(entry.name);
    if (nt && !byTitle.has(nt)) byTitle.set(nt, entry);
    if (nt) {
      const list = tokens(nt);
      indexed.push({ entry, tokens: new Set(list), tokenList: list });
    }
  }
  return { byIssn, byTitle, entries: indexed };
}

function isProperSubset(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0 || small.size >= big.size) return false;
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

function isPrefix(prefix: string[], list: string[]): boolean {
  if (prefix.length === 0 || prefix.length >= list.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== list[i]) return false;
  }
  return true;
}

/**
 * Match one item's journal fields against the catalog.
 * Returns the entry and the matching strategy, or undefined.
 */
export function matchJournal(
  fields: ItemJournalFields,
  index: LookupIndex,
): MatchInfo | undefined {
  for (const issn of extractIssns(fields.issn)) {
    const entry = index.byIssn.get(issn);
    if (entry) return { entry, via: "issn" };
  }

  const nt = normalizeTitle(fields.title);
  if (!nt) return undefined;

  const exact = index.byTitle.get(nt);
  if (exact) return { entry: exact, via: "title" };

  // Subset matching is intentionally limited to multi-word item titles:
  // single generic words ("Brain", "Sleep") would otherwise be matched to a
  // superset phrase of an unrelated journal.
  const itemTokenList = tokens(nt);
  if (itemTokenList.length < 2) return undefined;
  const itemTokens = new Set(itemTokenList);
  const candidates: IndexedEntry[] = [];
  for (const indexed of index.entries) {
    if (isProperSubset(itemTokens, indexed.tokens)) candidates.push(indexed);
  }
  if (candidates.length === 1) {
    return { entry: candidates[0].entry, via: "title-tokens" };
  }
  if (candidates.length > 1) {
    // Prefix tie-break: "Space Weather" wins over "Journal of Space Weather
    // and Space Climate" because it matches the beginning of the title.
    const prefixed = candidates.filter((c) =>
      isPrefix(itemTokenList, c.tokenList),
    );
    if (prefixed.length === 1) {
      return { entry: prefixed[0].entry, via: "title-prefix" };
    }
  }
  return undefined;
}
