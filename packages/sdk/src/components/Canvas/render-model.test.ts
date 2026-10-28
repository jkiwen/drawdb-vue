import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { togglesForDisplayMode } from "@drawdb/core";
import type { LogicalDomain, Table, ViewStateToggles } from "@drawdb/core";
import {
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
} from "./geometry.ts";
import {
  renderEdgeAnchor,
  renderRelationshipBounds,
  tableRenderBounds,
} from "./render-geometry.ts";
import {
  descriptionHeight,
  descriptionLineCount,
  logicalTypeLabel,
  tableDescription,
  tableFieldRows,
  tableRenderModel,
  tableTitle,
} from "./render-model.ts";

/**
 * A table with both layers populated: the logical entity renames the table
 * and its attributes, one attribute misses its logical name (the fallback
 * badge case), one attribute uses a domain and one a family.
 */
function makeTable(overrides: Partial<Table> = {}): Table {
  return {
    id: "t1",
    name: "users",
    x: 0,
    y: 0,
    comment: "the people table",
    logical: {
      id: "l_t1",
      name: "Customer",
      description: "the people",
      attributes: [
        {
          id: "a1",
          name: "identifier",
          logicalType: { family: "integer" },
          fieldId: "f1",
          keyRole: "primary",
          required: true,
        },
        {
          id: "a2",
          name: "email address",
          logicalType: { domainId: "Email" },
          fieldId: "f2",
          keyRole: "foreign",
        },
        {
          id: "a3",
          name: "",
          logicalType: { family: "string" },
          fieldId: "f3",
          keyRole: "alternate",
        },
      ],
    },
    fields: [
      {
        id: "f1",
        name: "id",
        fieldType: { type: "INTEGER" },
        fieldTypeSource: "explicit",
        primary: true,
        notNull: true,
      },
      {
        id: "f2",
        name: "email",
        fieldType: { type: "VARCHAR", length: 255 },
        fieldTypeSource: "explicit",
      },
      {
        id: "f3",
        name: "nickname",
        fieldType: { type: "VARCHAR", length: 64 },
        fieldTypeSource: "explicit",
        unique: true,
      },
    ],
    ...overrides,
  };
}

const DOMAINS: Record<string, LogicalDomain> = {
  Email: { id: "Email", name: "Email address", family: "string" },
};

describe("logicalTypeLabel", () => {
  it("labels a builtin family with its id", () => {
    const label = logicalTypeLabel({ family: "string" });
    assert.equal(label.label, "string");
    assert.equal(label.placeholder, false);
  });

  it("labels a domain with its name when the domains are known", () => {
    const label = logicalTypeLabel({ domainId: "Email" }, DOMAINS);
    assert.equal(label.label, "Email address");
    assert.equal(label.placeholder, false);
  });

  it("falls back to the domain id when the domain is unknown", () => {
    const label = logicalTypeLabel({ domainId: "Email" });
    assert.equal(label.label, "Email");
    assert.equal(label.placeholder, true);
  });
});

describe("tableTitle", () => {
  it("uses the physical name in the physical layer", () => {
    assert.deepEqual(tableTitle(makeTable(), "physical"), {
      text: "users",
      fallback: false,
    });
  });

  it("uses the logical entity name in the logical layer", () => {
    assert.deepEqual(tableTitle(makeTable(), "logical"), {
      text: "Customer",
      fallback: false,
    });
  });

  it("falls back to the physical name when the logical name is missing", () => {
    const table = makeTable();
    table.logical = { ...table.logical, name: "" };
    assert.deepEqual(tableTitle(table, "logical"), {
      text: "users",
      fallback: true,
    });
  });
});

describe("tableDescription", () => {
  it("reads the comment in the physical layer", () => {
    assert.equal(tableDescription(makeTable(), "physical"), "the people table");
  });

  it("reads the logical description in the logical layer", () => {
    assert.equal(tableDescription(makeTable(), "logical"), "the people");
  });
});

describe("description lines and height", () => {
  it("wraps the text at the width of the table", () => {
    // A 220px table fits about 32 characters a line ((220 - 28) / 6).
    const text = "x".repeat(70);
    assert.equal(descriptionLineCount(text, 220), 3);
    assert.equal(
      descriptionHeight(text, 220),
      3 * 16 + 12,
    );
  });

  it("caps the text at five lines and counts empty text as nothing", () => {
    assert.equal(descriptionLineCount("x".repeat(1000), 220), 5);
    assert.equal(descriptionLineCount("", 220), 0);
    assert.equal(descriptionHeight("", 220), 0);
  });
});

describe("tableFieldRows in the physical layer", () => {
  it("lists the fields with their physical names and type specifications", () => {
    const rows = tableFieldRows(makeTable(), "physical");
    assert.equal(rows.length, 3);
    assert.equal(rows[0].name, "id");
    assert.equal(rows[0].typeLabel, "INTEGER");
    assert.equal(rows[1].typeLabel, "VARCHAR(255)");
    assert.equal(rows[0].primary, true);
    assert.equal(rows[0].notNull, true);
    assert.equal(rows[2].unique, true);
  });

  it("marks the foreign keys the caller knows about", () => {
    const rows = tableFieldRows(makeTable(), "physical", {
      foreignFieldIds: new Set(["f2"]),
    });
    assert.equal(rows[1].foreign, true);
    assert.equal(rows[0].foreign, false);
  });
});

describe("tableFieldRows in the logical layer", () => {
  it("lists the attributes with their logical names and type labels", () => {
    const rows = tableFieldRows(makeTable(), "logical", { domains: DOMAINS });
    assert.equal(rows.length, 3);
    assert.equal(rows[0].name, "identifier");
    assert.equal(rows[0].typeLabel, "integer");
    assert.equal(rows[1].name, "email address");
    assert.equal(rows[1].typeLabel, "Email address");
    assert.equal(rows[1].typePlaceholder, false);
  });

  it("maps the key roles and the required flag to the marks", () => {
    const rows = tableFieldRows(makeTable(), "logical");
    assert.equal(rows[0].primary, true);
    assert.equal(rows[0].notNull, true);
    assert.equal(rows[1].foreign, true);
    assert.equal(rows[2].unique, true);
  });

  it("falls back to the physical name with a badge when the logical name is missing", () => {
    const rows = tableFieldRows(makeTable(), "logical");
    assert.equal(rows[2].name, "nickname");
    assert.equal(rows[2].nameFallback, true);
    assert.equal(rows[0].nameFallback, false);
  });

  it("marks the domain id as a placeholder when the domain is unknown", () => {
    const rows = tableFieldRows(makeTable(), "logical");
    assert.equal(rows[1].typeLabel, "Email");
    assert.equal(rows[1].typePlaceholder, true);
  });
});

describe("tableRenderModel display modes", () => {
  const table = makeTable();

  it("entity mode shows only the title", () => {
    const model = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("entity"),
    );
    assert.equal(model.title, "users");
    assert.equal(model.showDescription, false);
    assert.equal(model.showFields, false);
    assert.equal(model.showKeyMarks, false);
    assert.equal(model.rows.length, 0);
    assert.equal(model.headerHeight, TABLE_HEADER_HEIGHT);
    assert.equal(model.height, TABLE_HEADER_HEIGHT);
  });

  it("definition mode adds the description but no fields", () => {
    const model = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("definition"),
    );
    assert.equal(model.showDescription, true);
    assert.equal(model.description, "the people table");
    assert.equal(model.rows.length, 0);
    assert.equal(
      model.headerHeight,
      TABLE_HEADER_HEIGHT + descriptionHeight("the people table", 220),
    );
    assert.equal(model.height, model.headerHeight);
  });

  it("attributes mode shows the fields without the description", () => {
    const model = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("attributes"),
    );
    assert.equal(model.showDescription, false);
    assert.equal(model.showFields, true);
    assert.equal(model.rows.length, 3);
    assert.equal(
      model.height,
      TABLE_HEADER_HEIGHT + 3 * TABLE_FIELD_HEIGHT,
    );
  });

  it("all mode shows everything, including the key marks", () => {
    const model = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("all"),
    );
    assert.equal(model.showDescription, true);
    assert.equal(model.showFields, true);
    assert.equal(model.showKeyMarks, true);
    assert.equal(
      model.height,
      model.headerHeight + 3 * TABLE_FIELD_HEIGHT,
    );
  });

  it("renders the logical layer with the logical names", () => {
    const model = tableRenderModel(
      table,
      "logical",
      togglesForDisplayMode("all"),
      { domains: DOMAINS },
    );
    assert.equal(model.title, "Customer");
    assert.equal(model.description, "the people");
    assert.deepEqual(model.rows.map((row) => row.name), [
      "identifier",
      "email address",
      "nickname",
    ]);
    assert.deepEqual(model.rows.map((row) => row.typeLabel), [
      "integer",
      "Email address",
      "string",
    ]);
  });

  it("lets a per-table override win over the global toggles", () => {
    const model = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("attributes"),
      { overrides: { fields: false } },
    );
    assert.equal(model.rows.length, 0);
    assert.equal(model.height, TABLE_HEADER_HEIGHT);
  });

  it("keeps a collapsed table at its header height", () => {
    const model = tableRenderModel(
      makeTable({ collapsed: true }),
      "physical",
      togglesForDisplayMode("all"),
    );
    assert.equal(model.height, model.headerHeight);
  });

  it("ignores the indexes toggle for now (placeholder of P2')", () => {
    const withIndexes: ViewStateToggles = {
      description: false,
      fields: true,
      pkUkFk: false,
      indexes: true,
    };
    const model = tableRenderModel(table, "physical", withIndexes);
    assert.equal(model.rows.length, 3);
  });
});

describe("tableRenderBounds", () => {
  const table = makeTable();

  it("bounds the table by its render model", () => {
    const bounds = tableRenderBounds(
      table,
      "physical",
      togglesForDisplayMode("attributes"),
    );
    assert.deepEqual(bounds, {
      minX: 0,
      minY: 0,
      maxX: 220,
      maxY: TABLE_HEADER_HEIGHT + 3 * TABLE_FIELD_HEIGHT,
    });
  });

  it("shrinks with the entity mode and grows with the description", () => {
    const entity = tableRenderBounds(
      table,
      "physical",
      togglesForDisplayMode("entity"),
    );
    assert.equal(entity.maxY, TABLE_HEADER_HEIGHT);
    const definition = tableRenderBounds(
      table,
      "physical",
      togglesForDisplayMode("definition"),
    );
    assert.ok(definition.maxY > entity.maxY);
  });
});

describe("renderEdgeAnchor", () => {
  const table = makeTable();
  const toggles = togglesForDisplayMode("attributes");
  const model = tableRenderModel(table, "physical", toggles);

  it("anchors on the row of the field, on the side nearest to the target", () => {
    const anchor = renderEdgeAnchor(table, model, "f2", { x: 500, y: 0 });
    assert.equal(anchor.side, "right");
    assert.equal(anchor.x, 220);
    assert.equal(
      anchor.y,
      TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT + TABLE_FIELD_HEIGHT / 2,
    );
  });

  it("anchors the rows of the logical layer by their physical field", () => {
    const logical = tableRenderModel(table, "logical", toggles);
    const anchor = renderEdgeAnchor(table, logical, "f3", { x: -100, y: 0 });
    assert.equal(anchor.side, "left");
    assert.equal(anchor.x, 0);
    assert.equal(
      anchor.y,
      TABLE_HEADER_HEIGHT + 2 * TABLE_FIELD_HEIGHT + TABLE_FIELD_HEIGHT / 2,
    );
  });

  it("clamps to the edge when the fields are hidden", () => {
    const header = tableRenderModel(
      table,
      "physical",
      togglesForDisplayMode("entity"),
    );
    const anchor = renderEdgeAnchor(table, header, "f2", { x: 500, y: 30 });
    assert.equal(anchor.side, "right");
    assert.equal(anchor.y, 30);
    const outOfBounds = renderEdgeAnchor(table, header, "f2", {
      x: 500,
      y: 500,
    });
    assert.equal(outOfBounds.y, TABLE_HEADER_HEIGHT);
  });

  it("anchors across the top and the bottom edges", () => {
    const anchor = renderEdgeAnchor(table, model, "f2", { x: 60, y: -100 });
    assert.equal(anchor.side, "top");
    assert.deepEqual(
      { x: anchor.x, y: anchor.y },
      { x: 60, y: 0 },
    );
  });

  it("clamps the row anchor of a collapsed table to its header", () => {
    const collapsed = tableRenderModel(
      makeTable({ collapsed: true }),
      "physical",
      toggles,
    );
    const anchor = renderEdgeAnchor(
      makeTable({ collapsed: true }),
      collapsed,
      "f3",
      { x: 500, y: 40 },
    );
    assert.equal(anchor.side, "right");
    assert.ok(anchor.y <= TABLE_HEADER_HEIGHT);
  });
});

describe("renderRelationshipBounds", () => {
  it("spans the anchors of the two tables", () => {
    const other = makeTable({ id: "t2", name: "orders", x: 400, y: 200 });
    const relationship = {
      id: "r1",
      startTableId: "t1",
      startFieldId: "f1",
      endTableId: "t2",
      endFieldId: "f1",
      cardinality: "one_to_many" as const,
    };
    const bounds = renderRelationshipBounds(
      relationship,
      makeTable(),
      other,
      "physical",
      togglesForDisplayMode("attributes"),
    );
    assert.ok(bounds.minX >= 0 && bounds.minX <= 220);
    assert.ok(bounds.maxX >= 400 && bounds.maxX <= 620);
    assert.ok(bounds.minY >= TABLE_HEADER_HEIGHT);
    assert.ok(bounds.maxY <= 200 + TABLE_HEADER_HEIGHT + 3 * TABLE_FIELD_HEIGHT);
  });
});
