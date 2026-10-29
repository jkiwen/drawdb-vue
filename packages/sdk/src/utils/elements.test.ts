import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  areaNests,
  createArea,
  elementBounds,
  heldByCollapsedArea,
  heldByLockedArea,
  withOpacity,
} from "./elements.ts";

describe("createArea", () => {
  it("creates an area without a description by default", () => {
    const area = createArea("core");
    assert.equal(area.name, "core");
    assert.equal(area.description, undefined);
  });

  it("creates an area with the description it is given", () => {
    const area = createArea("core", { x: 10, y: 20 }, "The core tables");
    assert.equal(area.description, "The core tables");
    assert.equal(area.x, 10);
    assert.equal(area.y, 20);
  });
});

describe("heldByCollapsedArea", () => {
  const area = {
    id: "a1",
    name: "a1",
    x: 40,
    y: 60,
    width: 240,
    height: 160,
    collapsed: true,
  };

  it("holds the element whose corner sits in the collapsed area", () => {
    assert.equal(
      heldByCollapsedArea([area], elementBounds({ x: 60, y: 80 })),
      true,
    );
    // The corner is on the edge of the rectangle.
    assert.equal(
      heldByCollapsedArea([area], elementBounds({ x: 280, y: 220 })),
      true,
    );
  });

  it("does not hold the element outside the area", () => {
    assert.equal(
      heldByCollapsedArea([area], elementBounds({ x: 600, y: 600 })),
      false,
    );
  });

  it("holds nothing while the area is expanded", () => {
    assert.equal(
      heldByCollapsedArea(
        [{ ...area, collapsed: false }],
        elementBounds({ x: 60, y: 80 }),
      ),
      false,
    );
    assert.equal(
      heldByCollapsedArea([], elementBounds({ x: 60, y: 80 })),
      false,
    );
  });
});

describe("heldByLockedArea", () => {
  const area = {
    id: "a1",
    name: "a1",
    x: 40,
    y: 60,
    width: 240,
    height: 160,
    locked: true,
  };

  it("holds the element whose corner sits in the locked area", () => {
    assert.equal(
      heldByLockedArea([area], elementBounds({ x: 60, y: 80 })),
      true,
    );
    assert.equal(
      heldByLockedArea([area], elementBounds({ x: 280, y: 220 })),
      true,
    );
  });

  it("holds nothing outside the area or while the area is unlocked", () => {
    assert.equal(
      heldByLockedArea([area], elementBounds({ x: 600, y: 600 })),
      false,
    );
    assert.equal(
      heldByLockedArea(
        [{ ...area, locked: false }],
        elementBounds({ x: 60, y: 80 }),
      ),
      false,
    );
    assert.equal(
      heldByLockedArea([], elementBounds({ x: 60, y: 80 })),
      false,
    );
  });
});

describe("elementBounds", () => {
  it("gives the size of a table from its fields", () => {
    const table = {
      id: "t1",
      name: "users",
      x: 40,
      y: 60,
      fields: [
        { id: "f1", name: "id", type: "INTEGER" },
        { id: "f2", name: "email", type: "VARCHAR" },
      ],
    } as unknown as Parameters<typeof elementBounds>[0];
    const bounds = elementBounds(table);
    assert.equal(bounds.x, 40);
    assert.equal(bounds.y, 60);
    assert.equal(bounds.width, 220);
    // The header, the two fields and no details.
    assert.equal(bounds.height, 122);
  });

  it("gives the size of a note and of a view", () => {
    const note = {
      id: "n1",
      x: 10,
      y: 20,
      title: "a note",
      content: "something",
    } as unknown as Parameters<typeof elementBounds>[0];
    assert.deepEqual(elementBounds(note), {
      x: 10,
      y: 20,
      width: 220,
      height: 120,
    });

    const view = {
      id: "v1",
      x: 30,
      y: 40,
      name: "a view",
      baseTableId: "t1",
    } as unknown as Parameters<typeof elementBounds>[0];
    assert.deepEqual(elementBounds(view), {
      x: 30,
      y: 40,
      width: 240,
      height: 80,
    });
  });

  it("keeps the size an element stores", () => {
    const note = {
      id: "n1",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      title: "a note",
      content: "something",
    } as unknown as Parameters<typeof elementBounds>[0];
    assert.deepEqual(elementBounds(note), {
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
  });
});

describe("withOpacity", () => {
  it("softens a hex color to the opacity it is given", () => {
    assert.equal(withOpacity("#175e7a", 0.08), "rgba(23, 94, 122, 0.08)");
    assert.equal(withOpacity("#175e7a", 1), "rgba(23, 94, 122, 1)");
  });

  it("expands a short hex color", () => {
    assert.equal(withOpacity("#f00", 0.5), "rgba(255, 0, 0, 0.5)");
  });

  it("passes a color it cannot soften through", () => {
    assert.equal(withOpacity("red", 0.5), "red");
  });
});

describe("areaNests", () => {
  const outer = { x: 0, y: 0, width: 400, height: 300 };

  it("nests an area that lies wholly inside another one", () => {
    assert.equal(
      areaNests(outer, { x: 40, y: 40, width: 120, height: 80 }),
      true,
    );
  });

  it("does not nest two areas that merely overlap", () => {
    // Two areas that share a corner are siblings, not parent and child: dragging
    // one of them must not carry the other along (bug report of 2026-10-29).
    assert.equal(
      areaNests(outer, { x: 300, y: 220, width: 200, height: 160 }),
      false,
    );
  });

  it("does not nest an area that contains the other one", () => {
    assert.equal(
      areaNests(outer, { x: -20, y: -20, width: 500, height: 400 }),
      false,
    );
  });

  it("does not nest an area that covers exactly the same rectangle", () => {
    assert.equal(
      areaNests(outer, { x: 0, y: 0, width: 400, height: 300 }),
      false,
    );
  });
});
