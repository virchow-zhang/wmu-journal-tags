/**
 * Integration tests, executed inside Zotero by `npm test`
 * (zotero-plugin test). Uses a dedicated dev profile.
 */
import { assert } from "chai";
import { config } from "../package.json";

declare const Zotero: any;

const getAddon = () => Zotero[config.addonInstance];

async function waitForReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getAddon()?.data?.initialized) return;
    await Zotero.Promise.delay(200);
  }
  throw new Error("Plugin not initialized");
}

async function makeItem(publicationTitle: string, issn: string) {
  const item = new Zotero.Item("journalArticle");
  item.libraryID = Zotero.Libraries.userLibraryID;
  item.setField("title", `itest-${publicationTitle}`);
  item.setField("publicationTitle", publicationTitle);
  if (issn) item.setField("ISSN", issn);
  await item.saveTx();
  return item;
}

describe("WMU journal tags plugin", function () {
  this.timeout(120000);

  before(async function () {
    await Zotero.initializationPromise;
    await waitForReady();
  });

  it("loads the full catalog", function () {
    assert.equal(getAddon().api.catalogSize, 2965);
  });

  it("matches by ISSN and tags a T2(A) journal (idempotent)", async function () {
    const item = await makeItem("Nature Medicine", "1078-8956");
    try {
      const stats = await getAddon().api.updateItems([item]);
      assert.equal(stats.matched, 1);
      assert.equal(stats.unmatched, 0);
      const tags = item.getTags().map((t: any) => t.tag);
      assert.include(tags, "WMU:T2(A)");

      const stats2 = await getAddon().api.updateItems([item]);
      assert.equal(stats2.tagged, 0);
      assert.equal(stats2.unchanged, 1);
    } finally {
      await item.eraseTx();
    }
  });

  it("tags review journals with the review marker", async function () {
    const item = await makeItem("Nature Reviews Cancer", "1474-175X");
    try {
      await getAddon().api.updateItems([item]);
      const tags = item.getTags().map((t: any) => t.tag);
      assert.include(tags, "WMU:T2(B)");
      assert.include(tags, "WMU:综述");
    } finally {
      await item.eraseTx();
    }
  });

  it("matches by title without ISSN and cleans stale tags", async function () {
    const item = await makeItem("Space Weather", "");
    item.addTag("WMU:Q1", 1); // stale tag from a hypothetical old catalog
    await item.saveTx();
    try {
      await getAddon().api.updateItems([item]);
      const tags = item.getTags().map((t: any) => t.tag);
      assert.include(tags, "WMU:Q2");
      assert.notInclude(tags, "WMU:Q1");
    } finally {
      await item.eraseTx();
    }
  });

  it("ignores non-journal items", async function () {
    const item = new Zotero.Item("book");
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField("title", "itest-book");
    await item.saveTx();
    try {
      const stats = await getAddon().api.updateItems([item]);
      assert.equal(stats.total, 0);
    } finally {
      await item.eraseTx();
    }
  });

  it("reports unmatched journals without tagging", async function () {
    const item = await makeItem("Definitely Not In Catalog", "1234-5678");
    try {
      const stats = await getAddon().api.updateItems([item]);
      assert.equal(stats.unmatched, 1);
      assert.equal(item.getTags().length, 0);
    } finally {
      await item.eraseTx();
    }
  });
});
