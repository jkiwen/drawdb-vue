import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Table } from "@drawdb/core";
import { A4, PRINT_GAP, PRINT_MARGIN, boxWidth, pageCount, printFieldLines, printPages } from "./print-layout.ts";

/** A table whose fields carry the names the sheet prints. */
function table(id: string, fields: string[], name: string = id): Table {
  const built = {
    id,
    name,
    x: 0,
    y: 0,
    fields: fields.map((field, at) => ({
      id: `${id}_${at}`,
      name: field,
      fieldType: { type: "INTEGER" },
      fieldTypeSource: "mapped",
    })),
    logical: { id: `l_${id}`, name, attributes: [] },
  };
  return built as unknown as Table;
}

describe("print layout", () => {
  it("prints the name and the typed fields of a table", () => {
    const lines = printFieldLines(table("users", ["id", "email"]));
    assert.deepEqual(lines, ["id  INTEGER", "email  INTEGER"]);
  });

  it("stops the fields of a table at the limit it is given", () => {
    const lines = printFieldLines(table("wide", ["a", "b", "c", "d"]), 2);
    assert.deepEqual(lines, ["a  INTEGER", "b  INTEGER"]);
  });

  it("measures a box from its longest line, within limits", () => {
    const short = boxWidth(table("a", []), []);
    const long = boxWidth(table("a_table_with_a_rather_long_name", []), []);
    assert.ok(short >= 150);
    assert.ok(long <= 260);
    assert.ok(long > short);
  });

  it("keeps a single table on the first page, at the margin", () => {
    const pages = printPages([table("users", ["id", "email"])]);
    assert.equal(pages.length, 1);
    assert.equal(pages[0]!.boxes.length, 1);
    assert.equal(pages[0]!.boxes[0]!.x, PRINT_MARGIN);
    assert.equal(pages[0]!.boxes[0]!.y, PRINT_MARGIN);
  });

  it("wraps the boxes at the width of the page", () => {
    const wide = Array.from({ length: 6 }, (_unused, at) => table(`t${at}`, ["a_field_with_a_long_name"]));
    const pages = printPages(wide);
    const first = pages[0]!.boxes;
    assert.ok(first.length > 1, "the page holds more than one box");
    assert.ok(
      first.every((box) => box.x + box.width <= A4.width - PRINT_MARGIN),
      "no box crosses the right margin",
    );
  });

  it("starts the next page when the height is spent", () => {
    const many = Array.from({ length: 90 }, (_unused, at) => table(`t${at}`, ["id", "email"]));
    const pages = printPages(many);
    assert.ok(pages.length > 1, "the sheet needs more than one page");
    assert.equal(pageCount(many), pages.length);
    assert.equal(pages[0]!.index, 0);
    assert.equal(pages[1]!.index, 1);
    assert.ok(
      pages[0]!.boxes.every((box) => box.y + box.height <= A4.height - PRINT_MARGIN),
      "no box crosses the bottom margin",
    );
  });

  it("keeps the gaps between the boxes of a row", () => {
    const pages = printPages([table("a", []), table("b", []), table("c", [])]);
    const boxes = pages[0]!.boxes;
    assert.equal(boxes[1]!.x, boxes[0]!.x + boxes[0]!.width + PRINT_GAP);
  });

  it("prints an empty diagram as no page at all", () => {
    assert.deepEqual(printPages([]), []);
  });
});
