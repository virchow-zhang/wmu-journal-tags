import {
  registerClassificationColumn,
  unregisterClassificationColumn,
} from "./modules/column";
import { registerMenus, unregisterMenus } from "./modules/menu";
import { registerAutoTagger, unregisterAutoTagger } from "./modules/notifier";
import { getLocaleID, getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });

  registerMenus();
  registerAutoTagger();
  registerClassificationColumn();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Self-check: menu labels are resolved by the window document's l10n bundle
  try {
    const l10n = (win.document as unknown as { l10n?: Localization }).l10n;
    const label = await l10n?.formatValue(getLocaleID("menu-item-update"));
    ztoolkit.log(`menu label resolved: ${label}`);
  } catch (e) {
    ztoolkit.log("menu label resolution failed", e);
  }
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  unregisterAutoTagger();
  unregisterMenus();
  unregisterClassificationColumn();
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
