/**
 * Auto-tagging: listens for newly added items and applies classification
 * tags after a short debounce (metadata may still be written right after an
 * item is created, e.g. during sync or DOI lookup).
 */
import { config } from "../../package.json";
import { getPref } from "../utils/prefs";
import { getIndex } from "./catalog";
import { readJournalFields } from "./engine";
import { matchJournal } from "./matcher";
import { applyTagsToItem } from "./tagger";

let observerID: string | false = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
const queue = new Set<number>();

function schedule(ids: Array<string | number>): void {
  for (const id of ids) queue.add(Number(id));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 2000);
}

async function flush(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const batch = [...queue];
    queue.clear();
    const index = getIndex();
    for (const id of batch) {
      if (!getPref("autoTagOnAdd")) break;
      try {
        const item = Zotero.Items.get(id);
        if (!item || item.deleted || !item.isRegularItem()) continue;
        const match = matchJournal(readJournalFields(item), index);
        if (match) {
          await applyTagsToItem(item, match.entry, { skipIfClassified: true });
        }
      } catch (e) {
        ztoolkit.log("auto-tag: item failed", id, e);
      }
    }
  } finally {
    running = false;
    if (queue.size && getPref("autoTagOnAdd")) void flush();
  }
}

export function registerAutoTagger(): void {
  observerID = Zotero.Notifier.registerObserver(
    {
      notify: (event, type, ids) => {
        if (event === "add" && type === "item" && getPref("autoTagOnAdd")) {
          schedule(ids);
        }
      },
    },
    ["item"],
    config.addonRef,
  );
}

export function unregisterAutoTagger(): void {
  if (observerID) {
    Zotero.Notifier.unregisterObserver(observerID);
    observerID = false;
  }
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  queue.clear();
}
