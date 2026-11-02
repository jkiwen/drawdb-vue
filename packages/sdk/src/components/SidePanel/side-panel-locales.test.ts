import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";
import { setLocale } from "../../i18n/index.ts";
import CustomTypesTab from "./CustomTypesTab.vue";
import EnumsTab from "./EnumsTab.vue";
import NotesTab from "./NotesTab.vue";
import RelationshipsTab from "./RelationshipsTab.vue";
import ViewsTab from "./ViewsTab.vue";

/**
 * The side panel of the editor used to write English into the interface,
 * while the locales of the package carried the words already. The tabs now
 * read them from the locale of the user.
 */

function mountTab(component: unknown) {
  return mount(component as never, { global: { plugins: [naive] } });
}

describe("the side panel speaks the language of the user", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setLocale("en");
  });

  // The specs of the package share one process, so the locale of this spec
  // is put back before the next one runs.
  afterEach(() => {
    setLocale("en");
  });

  it("the empty states of the tabs are the words of the locale", () => {
    assert.match(mountTab(CustomTypesTab).html(), /You do not have any types configured/);
    assert.match(mountTab(NotesTab).html(), /No notes/);
    assert.match(mountTab(RelationshipsTab).html(), /No relationships/);
    assert.match(mountTab(ViewsTab).html(), /No views/);
  });

  it("the buttons of the tabs are the words of the locale", () => {
    assert.match(mountTab(CustomTypesTab).html(), /Add custom type/);
    assert.match(mountTab(EnumsTab).html(), /Add enum/);
  });

  it("the tabs follow the locale of the user", () => {
    setLocale("zh-CN");
    assert.match(mountTab(CustomTypesTab).html(), /您还没有配置任何类型/);
    assert.match(mountTab(ViewsTab).html(), /没有视图/);
    assert.match(mountTab(EnumsTab).html(), /添加枚举/);
  });
});
