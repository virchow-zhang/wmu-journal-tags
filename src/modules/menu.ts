/**
 * Context menus (Zotero 8+ official MenuManager API):
 *  - item context menu:     update selected items
 *  - collection context menu: update a collection and its subcollections
 *  - Tools menubar:          update the whole selected library
 */
import { config } from "../../package.json";
import { getLocaleID } from "../utils/locale";
import { updateCollection, updateItems, updateLibrary } from "./engine";

const registeredMenuIDs: string[] = [];

function addMenu(menuID: string | false, label: string): void {
  if (menuID) {
    registeredMenuIDs.push(menuID);
    ztoolkit.log(`registered menu: ${menuID} (${label})`);
  } else {
    ztoolkit.log(`FAILED to register menu: ${label}`, "error");
  }
}

function collectionFromContext(
  context: _ZoteroTypes.MenuManager.LibraryMenuContext,
): Zotero.Collection | undefined {
  // Zotero 10: reading `collectionTreeRow` of library menus throws;
  // use `collectionTreeRows` for the full selection instead.
  const rows = (
    context as unknown as { collectionTreeRows?: Array<{ ref?: unknown }> }
  ).collectionTreeRows;
  const ref = rows?.[0]?.ref;
  if (ref instanceof Zotero.Collection) return ref;
  const pane = Zotero.getActiveZoteroPane();
  const selected = pane?.getSelectedCollection();
  return selected instanceof Zotero.Collection ? selected : undefined;
}

export function registerMenus(): void {
  addMenu(
    Zotero.MenuManager.registerMenu({
      menuID: `${config.addonRef}-item-update`,
      pluginID: config.addonID,
      target: "main/library/item",
      menus: [
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menu-item-update"),
          onShowing: (_event, context) => {
            const items = context.items ?? [];
            context.setEnabled(
              items.some((item) => item && item.isRegularItem()),
            );
          },
          onCommand: async (_event, context) => {
            await updateItems(context.items ?? [], { progress: true });
          },
        },
      ],
    }),
    "menu-item-update",
  );

  addMenu(
    Zotero.MenuManager.registerMenu({
      menuID: `${config.addonRef}-collection-update`,
      pluginID: config.addonID,
      target: "main/library/collection",
      menus: [
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menu-collection-update"),
          onShowing: (_event, context) => {
            context.setEnabled(!!collectionFromContext(context));
          },
          onCommand: async (_event, context) => {
            const collection = collectionFromContext(context);
            if (collection) await updateCollection(collection);
          },
        },
      ],
    }),
    "menu-collection-update",
  );

  addMenu(
    Zotero.MenuManager.registerMenu({
      menuID: `${config.addonRef}-library-update`,
      pluginID: config.addonID,
      target: "main/menubar/tools",
      menus: [
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menu-library-update"),
          onCommand: async () => {
            const pane = Zotero.getActiveZoteroPane();
            const libraryID =
              pane?.getSelectedLibraryID() ?? Zotero.Libraries.userLibraryID;
            await updateLibrary(libraryID);
          },
        },
      ],
    }),
    "menu-library-update",
  );
}

export function unregisterMenus(): void {
  for (const menuID of registeredMenuIDs.splice(0)) {
    Zotero.MenuManager.unregisterMenu(menuID);
  }
}
