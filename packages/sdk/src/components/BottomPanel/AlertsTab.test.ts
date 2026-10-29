import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Diagram } from "@drawdb/core";
import { setLocale } from "../../i18n/index.ts";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import AlertsTab from "./AlertsTab.vue";
import { copyAlerts, exportAlerts } from "./alerts-export.ts";

/**
 * A mysql diagram with one fixable error (TYPE_NOT_IN_DIALECT) and one
 * fixable info (LOGICAL_PHYSICAL_DIVERGED): enough to exercise the severity
 * filter, the fix buttons and the copy/export toolbar.
 */
function seedFixable(): Diagram {
  return {
    id: "d1",
    title: "shop",
    database: "mysql",
    tables: [
      {
        id: "t1",
        name: "users",
        x: 0,
        y: 0,
        logical: {
          id: "l_t1",
          name: "users",
          attributes: [
            {
              id: "a_f1",
              name: "id",
              logicalType: { family: "string" },
              fieldId: "f1",
            },
          ],
        },
        fields: [
          {
            id: "f1",
            name: "id",
            fieldType: { type: "GEOGRAPHY" },
            fieldTypeSource: "mapped",
          },
        ],
        primaryKey: { id: "pk_users", name: "PK_users", logicalName: "PK_users", columns: [{ fieldId: "f1" }] },
      },
    ],
    relationships: [],
    notes: [],
    subjectAreas: [],
    types: [],
    enums: [],
    views: [],
  } as Diagram;
}

function mountTab() {
  return mount(AlertsTab);
}

describe("AlertsTab", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    setLocale("en");
  });

  afterEach(() => {
    // The copy and export tests install temporary globals; make sure a
    // failed assertion cannot leak them into another suite.
    delete (globalThis as Record<string, unknown>).__drawdbAlertsClipboard;
  });

  it("renders the four severity filters with the count of every level", () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    for (const level of ["all", "error", "warning", "info"]) {
      assert.ok(
        wrapper.find(`[data-testid="alerts-filter-${level}"]`).exists(),
        `the ${level} filter is missing`,
      );
    }
    const items = wrapper.findAll('[data-testid="alert-item"]');
    const levelCount = (severity: string) =>
      items.filter((item) => item.attributes("data-severity") === severity)
        .length;
    assert.equal(
      Number(wrapper.find('[data-testid="alerts-filter-count-all"]').text()),
      items.length,
    );
    assert.equal(
      Number(wrapper.find('[data-testid="alerts-filter-count-error"]').text()),
      levelCount("error"),
    );
    assert.equal(
      Number(wrapper.find('[data-testid="alerts-filter-count-warning"]').text()),
      levelCount("warning"),
    );
    assert.equal(
      Number(wrapper.find('[data-testid="alerts-filter-count-info"]').text()),
      levelCount("info"),
    );
    assert.equal(
      wrapper.find('[data-testid="alerts-filter-all"]').attributes("aria-pressed"),
      "true",
    );
  });

  it("filters the list down to the chosen severity", async () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    await wrapper.find('[data-testid="alerts-filter-error"]').trigger("click");
    const errors = wrapper.findAll('[data-testid="alert-item"]');
    assert.ok(errors.length > 0);
    for (const item of errors) {
      assert.equal(item.attributes("data-severity"), "error");
    }
    assert.equal(
      wrapper.find('[data-testid="alerts-filter-error"]').attributes("aria-pressed"),
      "true",
    );
    await wrapper.find('[data-testid="alerts-filter-info"]').trigger("click");
    const infos = wrapper.findAll('[data-testid="alert-item"]');
    assert.ok(infos.length > 0);
    for (const item of infos) {
      assert.equal(item.attributes("data-severity"), "info");
    }
  });

  it("shows a filter empty state when the level has no alert", async () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    await wrapper
      .find('[data-testid="alerts-filter-warning"]')
      .trigger("click");
    assert.ok(wrapper.find('[data-testid="alerts-filter-empty"]').exists());
    assert.equal(wrapper.findAll('[data-testid="alert-item"]').length, 0);
  });

  it("offers a fix button for every fixable alert only", () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    const buttons = wrapper.findAll('[data-testid^="alert-fix-"]');
    assert.ok(buttons.length > 0, "the fixable alert needs its fix button");
    for (const button of buttons) {
      assert.match(button.attributes("data-testid")!, /^alert-fix-\d+$/);
    }
    const items = wrapper.findAll('[data-testid="alert-item"]');
    assert.ok(buttons.length <= items.length);
  });

  it("applies the suggested fix through the diagram command stack", async () => {
    useDiagramStore().setDiagram(seedFixable());
    const history = useHistoryStore();
    const wrapper = mountTab();
    const fix = wrapper.find('[data-testid^="alert-fix-"]');
    assert.ok(fix.exists());
    await fix.trigger("click");
    const diagram = useDiagramStore();
    const field = diagram.diagram.tables[0].fields[0];
    assert.equal(field.fieldType.type, "VARCHAR");
    assert.equal(field.fieldTypeSource, "explicit");
    assert.equal(history.depth, 1);
  });

  it("copies the visible alerts as plain text", async () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    let copied = "";
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copied = text;
        },
      },
    });
    try {
      await wrapper.find('[data-testid="alerts-filter-error"]').trigger("click");
      await wrapper.find('[data-testid="alerts-copy"]').trigger("click");
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.ok(copied.includes("TYPE_NOT_IN_DIALECT"), copied);
      assert.ok(!copied.includes("LOGICAL_PHYSICAL_DIVERGED"), copied);
    } finally {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    }
  });

  it("returns false from copyAlerts when the clipboard is missing", async () => {
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const copied = await copyAlerts([
      {
        id: "a",
        source: "dialect",
        severity: "error",
        code: "X",
        label: "x",
        target: null,
        fixable: false,
      },
    ]);
    assert.equal(copied, false);
  });

  it("exports the visible alerts as a text file", async () => {
    useDiagramStore().setDiagram(seedFixable());
    const wrapper = mountTab();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    let blob: Blob | null = null;
    const download: { href?: string; name?: string } = {};
    let revoked = false;
    URL.createObjectURL = (value: Blob) => {
      blob = value;
      return "blob:drawdb";
    };
    URL.revokeObjectURL = () => {
      revoked = true;
    };
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      download.href = this.href;
      download.name = this.download;
    };
    try {
      await wrapper.find('[data-testid="alerts-filter-error"]').trigger("click");
      await wrapper.find('[data-testid="alerts-export"]').trigger("click");
      assert.ok(blob, "a blob was built");
      assert.equal((blob as Blob).type, "text/plain");
      assert.ok((await (blob as Blob).text()).includes("TYPE_NOT_IN_DIALECT"));
      assert.equal(download.name, "drawdb-alerts.txt");
      assert.equal(download.href, "blob:drawdb");
      assert.equal(revoked, true);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });

  it("returns false when the environment cannot create object URLs", () => {
    // Some hosts (and jsdom) do not implement URL.createObjectURL; the
    // export guard must refuse instead of throwing.
    const descriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });
    try {
      assert.equal(exportAlerts([]), false);
    } finally {
      if (descriptor) {
        Object.defineProperty(URL, "createObjectURL", descriptor);
      } else {
        delete (URL as { createObjectURL?: unknown }).createObjectURL;
      }
    }
  });
});
