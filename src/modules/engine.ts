/**
 * Batch orchestration: match a list of Zotero items against the WMU catalog
 * and write classification tags, with progress reporting and statistics.
 */
import { getIndex } from "./catalog";
import { matchJournal } from "./matcher";
import { applyTagsToItem } from "./tagger";
import type { ItemJournalFields } from "./types";
import { getString } from "../utils/locale";

export interface UpdateStats {
  /** Eligible regular items considered. */
  total: number;
  matched: number;
  unmatched: number;
  /** Items whose tags were actually changed. */
  tagged: number;
  /** Matched items that already had the correct tags. */
  unchanged: number;
  /** Journal titles not found in the catalog (title -> count). */
  unmatchedJournals: Map<string, number>;
}

/** Read the journal-relevant fields of an item, safely. */
export function readJournalFields(item: Zotero.Item): ItemJournalFields {
  let issn = "";
  let title = "";
  try {
    issn = (item.getField("ISSN") as string) || "";
  } catch {
    /* field not available for this item type */
  }
  try {
    title = (item.getField("publicationTitle") as string) || "";
  } catch {
    /* field not available for this item type */
  }
  return { issn, title };
}

function isEligible(item: Zotero.Item | undefined | null): item is Zotero.Item {
  return !!item && !item.deleted && item.isRegularItem();
}

/**
 * Update classification tags for the given items.
 * @param items candidate items (non-regular items are ignored)
 * @param options.progress show a progress window
 */
export async function updateItems(
  items: Zotero.Item[],
  options: { progress?: boolean } = {},
): Promise<UpdateStats> {
  const targets = items.filter(isEligible);
  const stats: UpdateStats = {
    total: targets.length,
    matched: 0,
    unmatched: 0,
    tagged: 0,
    unchanged: 0,
    unmatchedJournals: new Map(),
  };

  const index = getIndex();
  const progressWin = options.progress
    ? new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({
          text: getString("progress-updating", {
            args: { done: 0, total: targets.length },
          }),
          type: "default",
          progress: 0,
        })
        .show()
    : null;

  let done = 0;
  for (const item of targets) {
    try {
      const fields = readJournalFields(item);
      const match = matchJournal(fields, index);
      if (!match) {
        stats.unmatched++;
        const key = (fields.title || "").trim() || "(无期刊名)";
        stats.unmatchedJournals.set(
          key,
          (stats.unmatchedJournals.get(key) ?? 0) + 1,
        );
      } else {
        stats.matched++;
        const result = await applyTagsToItem(item, match.entry);
        if (result.added.length || result.removed.length) stats.tagged++;
        else stats.unchanged++;
      }
    } catch (e) {
      ztoolkit.log("updateItems: item failed", item.id, e);
    }
    done++;
    if (progressWin && (done % 20 === 0 || done === targets.length)) {
      progressWin.changeLine({
        progress: Math.round((done / Math.max(targets.length, 1)) * 100),
        text: getString("progress-updating", {
          args: { done, total: targets.length },
        }),
      });
    }
  }

  if (progressWin) {
    progressWin.changeLine({
      progress: 100,
      type: stats.matched > 0 ? "success" : "default",
      text: getString("progress-finished", {
        args: {
          matched: stats.matched,
          tagged: stats.tagged,
          unmatched: stats.unmatched,
        },
      }),
    });
    progressWin.startCloseTimer(8000);
  }

  if (stats.unmatchedJournals.size) {
    ztoolkit.log(
      "updateItems: unmatched journals",
      Array.from(stats.unmatchedJournals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50),
    );
  }
  return stats;
}

/** Update every regular item of one collection (including subcollections). */
export async function updateCollection(
  collection: Zotero.Collection,
): Promise<UpdateStats> {
  const items = await collection.getChildItems();
  return updateItems(items, { progress: true });
}

/** Update every regular item of the given library. */
export async function updateLibrary(libraryID: number): Promise<UpdateStats> {
  const items = await Zotero.Items.getAll(libraryID);
  return updateItems(items, { progress: true });
}
