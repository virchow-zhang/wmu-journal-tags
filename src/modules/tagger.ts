/**
 * Tag writing: computes the classification tags for a catalog entry and
 * applies them to a Zotero item, removing stale classification tags added
 * by previous runs while leaving all other tags untouched.
 */
import type { CatalogEntry } from "./types";
import { getPref } from "../utils/prefs";

export const LEVELS = [
  "T1",
  "T2(A)",
  "T2(B)",
  "T3(A)",
  "T3(B)",
  "Q1",
  "Q2",
] as const;

export const REVIEW_TAG_SUFFIX = "综述";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefix for the plugin's classification tags (e.g. "WMU:"). */
export function getTagPrefix(): string {
  const raw = getPref("tagPrefix");
  const prefix = typeof raw === "string" ? raw.trim() : "";
  return prefix || "WMU:";
}

/** The tags a given catalog entry should produce. */
export function desiredTags(entry: CatalogEntry, prefix: string): string[] {
  const tags = [`${prefix}${entry.category}`];
  if (entry.isReview && getPref("markReview")) {
    tags.push(`${prefix}${REVIEW_TAG_SUFFIX}`);
  }
  return tags;
}

/** Regex matching only this plugin's classification tags (respects prefix). */
export function classificationTagPattern(prefix = getTagPrefix()): RegExp {
  const levels = LEVELS.map(escapeRegex).join("|");
  return new RegExp(
    `^${escapeRegex(prefix)}(?:${levels}|${escapeRegex(REVIEW_TAG_SUFFIX)})$`,
  );
}

export function isClassificationTag(tag: string, prefix?: string): boolean {
  return classificationTagPattern(prefix).test(tag);
}

export interface TagSyncResult {
  added: string[];
  removed: string[];
}

export interface TagSyncOptions {
  /** Fast path for auto-tagging: skip items that already carry a tag. */
  skipIfClassified?: boolean;
  /** Pass false to batch several changes before a single saveTx(). */
  save?: boolean;
}

/**
 * Synchronize the classification tags of one item with its catalog entry.
 * Idempotent: an item already carrying exactly the desired tags is unchanged.
 */
export async function applyTagsToItem(
  item: Zotero.Item,
  entry: CatalogEntry,
  options: TagSyncOptions = {},
): Promise<TagSyncResult> {
  const prefix = getTagPrefix();
  const pattern = classificationTagPattern(prefix);
  const existing = item.getTags().map((t) => t.tag);

  if (options.skipIfClassified && existing.some((t) => pattern.test(t))) {
    return { added: [], removed: [] };
  }

  const desired = desiredTags(entry, prefix);
  const stale = existing.filter((t) => pattern.test(t) && !desired.includes(t));
  const missing = desired.filter((t) => !existing.includes(t));

  if (!stale.length && !missing.length) return { added: [], removed: [] };

  for (const tag of stale) item.removeTag(tag);
  for (const tag of missing) item.addTag(tag, 1); // 1 = manual tag
  if (options.save !== false) {
    await item.saveTx();
  }
  return { added: missing, removed: stale };
}
