/**
 * Custom item-tree column "期刊分类": shows the WMU classification as a
 * colored badge, sortable from T1 down to Q2.
 *
 * Uses the official Zotero.ItemTreeManager.registerColumn API (Zotero 7+).
 */
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getIndex } from "./catalog";
import { readJournalFields } from "./engine";
import { matchJournal } from "./matcher";

/** Sort rank for each classification level. */
const RANK: Record<string, number> = {
  T1: 1,
  "T2(A)": 2,
  "T2(B)": 3,
  "T3(A)": 4,
  "T3(B)": 5,
  Q1: 6,
  Q2: 7,
};

const LEVEL_COLORS: Record<string, string> = {
  T1: "#c0392b",
  "T2(A)": "#d35400",
  "T2(B)": "#e67e22",
  "T3(A)": "#2471a3",
  "T3(B)": "#2980b9",
  Q1: "#1e8449",
  Q2: "#148f77",
};

const REVIEW_SUFFIX = "·综述";

let registeredDataKey: string | false = false;

/**
 * Per-item cache keyed by item id, invalidated by item version (item.version
 * changes on every save, so the cache stays correct while avoiding repeated
 * matching during scrolling).
 */
const matchCache = new Map<number, { version: number; label: string | null }>();

function resolveClassification(item: Zotero.Item): string | null {
  const cached = matchCache.get(item.id);
  if (cached && cached.version === item.version) return cached.label;

  let label: string | null = null;
  try {
    const match = matchJournal(readJournalFields(item), getIndex());
    if (match) {
      label = match.entry.category;
      if (match.entry.isReview) label += REVIEW_SUFFIX;
    }
  } catch (e) {
    ztoolkit.log("column: match failed", item.id, e);
  }
  matchCache.set(item.id, { version: item.version, label });
  return label;
}

function makeBadge(doc: Document, text: string, background: string): Element {
  const badge = doc.createElement("span");
  badge.textContent = text;
  badge.style.cssText = [
    "display: inline-block",
    "padding: 0 6px",
    "border-radius: 8px",
    "font-size: 11px",
    "line-height: 16px",
    "color: #fff",
    `background: ${background}`,
    "margin-right: 4px",
  ].join(";");
  return badge;
}

export function registerClassificationColumn(): void {
  registeredDataKey = Zotero.ItemTreeManager.registerColumn({
    dataKey: "classification",
    label: getString("column-label"),
    pluginID: config.addonID,
    enabledTreeIDs: ["main"],
    showInColumnPicker: true,
    columnPickerSubMenu: false,
    minWidth: 80,
    width: "120",
    zoteroPersist: ["width", "hidden", "sortDirection"],
    dataProvider: (item) => {
      if (!item.isRegularItem()) return "";
      const label = resolveClassification(item);
      if (!label) return "";
      const level = label.split(REVIEW_SUFFIX)[0];
      const rank = RANK[level] ?? 9;
      // The rank prefix makes the column sort as T1 < T2(A) < ... < Q2.
      return `${rank}:${label}`;
    },
    renderCell: (index, data, column, _isFirstColumn, doc) => {
      const cell = doc.createElement("span");
      cell.className = `cell ${column.className}`;
      const raw = String(data ?? "");
      if (!raw) return cell;
      const label = raw.split(":").slice(1).join(":");
      const level = label.split(REVIEW_SUFFIX)[0];
      cell.appendChild(makeBadge(doc, level, LEVEL_COLORS[level] ?? "#666666"));
      if (label.endsWith(REVIEW_SUFFIX)) {
        cell.appendChild(makeBadge(doc, "综述", "#7f8c8d"));
      }
      return cell;
    },
  });

  if (registeredDataKey) {
    ztoolkit.log(`registered column: ${registeredDataKey}`);
  } else {
    ztoolkit.log("FAILED to register classification column", "error");
  }
}

export function unregisterClassificationColumn(): void {
  if (registeredDataKey) {
    Zotero.ItemTreeManager.unregisterColumn(registeredDataKey);
    registeredDataKey = false;
  }
  matchCache.clear();
}
