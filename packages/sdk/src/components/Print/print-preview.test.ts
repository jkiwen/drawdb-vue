import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import type { Table } from "@drawdb/core";
import PrintPreviewDialog from "./PrintPreviewDialog.vue";

/** A table the preview can lay out. */
function table(id: string, fields: string[]): Table {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    fields: fields.map((field, at) => ({
      id: `${id}_${at}`,
      name: field,
      fieldType: { type: "INTEGER" },
      fieldTypeSource: "mapped",
    })),
    logical: { id: `l_${id}`, name: id, attributes: [] },
  } as unknown as Table;
}

function mountDialog(tables: Table[]) {
  return mount(PrintPreviewDialog, {
    props: { open: true, tables },
    global: { plugins: [createPinia()] },
  });
}

describe("print preview", () => {
  it("draws a box for every table of the first page", () => {
    const wrapper = mountDialog([table("users", ["id"]), table("posts", ["id"])]);
    assert.equal(wrapper.findAll('[data-testid^="print-box-"]').length, 2);
    assert.equal(wrapper.find('[data-testid="print-sheet"]').exists(), true);
  });

  it("counts the pages the sheet needs", () => {
    const many = Array.from({ length: 90 }, (_unused, at) => table(`t${at}`, ["id", "email"]));
    const wrapper = mountDialog(many);
    const counter = wrapper.get('[data-testid="print-page"]').text();
    assert.match(counter, /^1 \/ [2-9]\d*$/);
  });

  it("walks the pages with the arrows", async () => {
    const many = Array.from({ length: 90 }, (_unused, at) => table(`t${at}`, ["id", "email"]));
    const wrapper = mountDialog(many);
    const first = wrapper.get('[data-testid="print-page"]').text();
    await wrapper.get('[data-testid="print-next"]').trigger("click");
    const second = wrapper.get('[data-testid="print-page"]').text();
    assert.notEqual(second, first);
    assert.match(second, /^2 \/ /);
    await wrapper.get('[data-testid="print-previous"]').trigger("click");
    assert.equal(wrapper.get('[data-testid="print-page"]').text(), first);
  });

  it("shows the empty state without a table", () => {
    const wrapper = mountDialog([]);
    assert.equal(wrapper.find('[data-testid="print-empty"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="print-sheet"]').exists(), false);
    assert.equal(wrapper.get('[data-testid="print-page"]').text(), "0 / 0");
  });

  it("closes through the host, and hands the sheet to the browser", async () => {
    const wrapper = mountDialog([table("users", ["id"])]);
    const printed: number[] = [];
    const original = window.print;
    window.print = () => {
      printed.push(1);
    };
    try {
      await wrapper.get('[data-testid="print-run"]').trigger("click");
      await wrapper.get('[data-testid="print-close"]').trigger("click");
    } finally {
      window.print = original;
    }
    assert.equal(printed.length, 1);
    assert.equal(wrapper.emitted("update:open")?.[0]?.[0], false);
  });

  it("stays out of the document while it is closed", () => {
    const wrapper = mount(PrintPreviewDialog, {
      props: { open: false, tables: [table("users", ["id"])] },
      global: { plugins: [createPinia()] },
    });
    assert.equal(wrapper.find('[data-testid="print-preview"]').exists(), false);
  });
});
