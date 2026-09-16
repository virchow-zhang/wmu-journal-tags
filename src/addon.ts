import { config } from "../package.json";
import { ColumnOptions, DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import { catalogJournals } from "./modules/catalog";
import { updateCollection, updateItems, updateLibrary } from "./modules/engine";
import { getIndex } from "./modules/catalog";
import { matchJournal } from "./modules/matcher";
import type { CatalogEntry, ItemJournalFields } from "./modules/types";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
      columns: Array<ColumnOptions>;
      rows: Array<{ [dataKey: string]: string }>;
    };
    dialog?: DialogHelper;
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: {
    /** Number of journals in the bundled catalog. */
    catalogSize: number;
    /** Update classification tags for items. */
    updateItems: typeof updateItems;
    /** Update a whole collection (recursive). */
    updateCollection: typeof updateCollection;
    /** Update a whole library. */
    updateLibrary: typeof updateLibrary;
    /** Match raw journal fields against the catalog. */
    matchJournal: (
      fields: ItemJournalFields,
    ) => { entry: CatalogEntry; via: string } | undefined;
  };

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {
      catalogSize: catalogJournals.length,
      updateItems,
      updateCollection,
      updateLibrary,
      matchJournal: (fields: ItemJournalFields) => {
        const match = matchJournal(fields, getIndex());
        return match ? { entry: match.entry, via: match.via } : undefined;
      },
    };
  }
}

export default Addon;
