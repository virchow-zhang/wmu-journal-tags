/** Catalog data access: lazily builds the lookup index. */
import { catalogJournals, catalogMeta } from "../data/catalog";
import { buildIndex, type LookupIndex } from "./matcher";

export { catalogJournals, catalogMeta };

let index: LookupIndex | undefined;

/** Shared lookup index over all catalog entries (built once, on first use). */
export function getIndex(): LookupIndex {
  if (!index) index = buildIndex(catalogJournals);
  return index;
}
