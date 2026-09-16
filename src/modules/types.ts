/** Shared types for the WMU journal classification plugin. */

/** A single entry of the WMU consensus journal catalog. */
export interface CatalogEntry {
  /** Journal name as printed in the catalog (NLM-style full title). */
  name: string;
  /** Print/legacy ISSN as printed in the catalog (e.g. "0092-8674"). */
  issn: string;
  /** Classification: T1 | T2(A) | T2(B) | T3(A) | T3(B) | Q1 | Q2. */
  category: string;
  /** True for entries from the "综述类" (review journal) section. */
  isReview: boolean;
}

/** Journal-related fields read from a Zotero item. */
export interface ItemJournalFields {
  issn?: string | null;
  title?: string | null;
  abbr?: string | null;
}

/** Result of matching one item against the catalog. */
export interface MatchInfo {
  entry: CatalogEntry;
  /** How the entry was matched: "issn" | "title" | "title-tokens" | "title-prefix". */
  via: "issn" | "title" | "title-tokens" | "title-prefix";
}
