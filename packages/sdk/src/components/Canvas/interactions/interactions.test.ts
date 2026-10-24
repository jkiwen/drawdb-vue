import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { useDiagramStore } from "../../../stores/diagram.ts";
import { useContextMenu } from "./use-context-menu.ts";
import { useLinking } from "./use-linking.ts";
import { MIN_AREA_HEIGHT, MIN_AREA_WIDTH, useResize } from "./use-resize.ts";
import { useSelectionBox } from "./use-selection-box.ts";

/**
 * The interactions of the canvas.
 *
 * The specs cover the four composables of the interaction layer and the
 * canvas that draws their result. The DOM is installed by the test runner, a
 * spec must not install it a second time.
 */

function seed(pinia: Pinia) {
  setActivePinia(pinia);
  const diagram = useDiagramStore(pinia);

  diagram.addTable({
    id: "users",
    name: "users",
    x: 40,
    y: 60,
    fields: [
      { id: "users_id", name: "id", type: "INTEGER", primary: true, notNull: true },
      { id: "users_name", name: "name", type: "VARCHAR", size: 255 },
    ],
  });

  diagram.addTable({
    id: "posts",
    name: "posts",
    x: 420,
    y: 60,
    fields: [
      { id: "posts_id", name: "id", type: "INTEGER", primary: true },
      { id: "posts_user_id", name: "user_id", type: "INTEGER" },
    ],
  });

  diagram.addTable({
    id: "profiles",
    name: "profiles",
    x: 800,
    y: 60,
    fields: [
      { id: "profiles_id", name: "id", type: "INTEGER", primary: true },
      {
        id: "profiles_user_id",
        name: "user_id",
        type: "INTEGER",
        unique: true,
      },
    ],
  });

  return diagram;
}

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

describe("the interaction layer of the canvas", () => {
  it("useLinking starts a link from a field handle", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 12, y: 34 });

    assert.ok(linking.linking.value);
    assert.equal(linking.linking.value.sourceTableId, "posts");
    assert.equal(linking.linking.value.sourceFieldId, "posts_user_id");
    assert.deepEqual(linking.linking.value.pointer, { x: 12, y: 34 });
  });

  it("useLinking creates a relationship when the pointer is released on a field", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 0, y: 0 });
    const relationship = linking.finish({ tableId: "users", fieldId: "users_id" });

    assert.ok(relationship);
    assert.equal(relationship.startTableId, "posts");
    assert.equal(relationship.startFieldId, "posts_user_id");
    assert.equal(relationship.endTableId, "users");
    assert.equal(relationship.endFieldId, "users_id");
  });

  it("useLinking creates a relationship to the primary key of a table", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 0, y: 0 });
    const relationship = linking.finish({ tableId: "users" });

    assert.ok(relationship);
    assert.equal(relationship.endFieldId, "users_id");
  });

  it("useLinking cancels the linking when the pointer is released on the canvas", () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 0, y: 0 });
    const relationship = linking.finish();

    assert.equal(relationship, null);
    assert.equal(linking.linking.value, null);
    assert.equal(diagram.relationships.length, 0);
  });

  it("useLinking marks the cardinality one_to_one for a unique source field", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("profiles", "profiles_user_id", { x: 0, y: 0 });
    const relationship = linking.finish({ tableId: "users", fieldId: "users_id" });

    assert.ok(relationship);
    assert.equal(relationship.cardinality, "one_to_one");
  });

  it("useLinking names the relationship fk_<table>_<field>_<table>", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 0, y: 0 });
    const relationship = linking.finish({ tableId: "users", fieldId: "users_id" });

    assert.ok(relationship);
    assert.equal(relationship.name, "fk_posts_user_id_users");
  });

  it("useLinking cancel clears the state", () => {
    const pinia = freshPinia();
    seed(pinia);
    const linking = useLinking();

    linking.start("posts", "posts_user_id", { x: 0, y: 0 });
    linking.cancel();

    assert.equal(linking.linking.value, null);
  });

  it("useSelectionBox collects the tables inside the rectangle", () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const box = useSelectionBox();

    const ids = box.idsIn({ x: 0, y: 0, width: 300, height: 300 }, diagram.tables);

    assert.deepEqual(ids.map(String), ["users"]);
  });

  it("useSelectionBox returns no id for an empty rectangle", () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const box = useSelectionBox();

    const ids = box.idsIn({ x: 5000, y: 5000, width: 10, height: 10 }, diagram.tables);

    assert.deepEqual(ids, []);
  });

  it("useResize keeps the minimum size", () => {
    const resize = useResize();

    resize.begin({ kind: "table", id: "users", width: 200, height: 100 });
    resize.move(-500, -500);

    assert.ok(resize.resizing.value);
    assert.equal(resize.resizing.value.width, 120);
    assert.equal(resize.resizing.value.height, 60);
  });

  it("useResize reports the new width and height", () => {
    const resize = useResize();

    resize.begin({ kind: "table", id: "users", width: 200, height: 100 });
    resize.move(50, 20);

    assert.ok(resize.resizing.value);
    assert.equal(resize.resizing.value.width, 250);
    assert.equal(resize.resizing.value.height, 120);
  });

  it("useResize keeps the smallest size of an area", () => {
    const resize = useResize();

    resize.begin({ kind: "area", id: "area-1", width: 240, height: 160 });
    resize.move(-500, -500);

    assert.ok(resize.resizing.value);
    assert.equal(resize.resizing.value.kind, "area");
    assert.equal(resize.resizing.value.id, "area-1");
    assert.equal(resize.resizing.value.width, MIN_AREA_WIDTH);
    assert.equal(resize.resizing.value.height, MIN_AREA_HEIGHT);
  });

  it("useContextMenu opens at a point with a target", () => {
    const menu = useContextMenu();

    menu.open(12, 34, { kind: "table", tableId: "users" });

    assert.ok(menu.menu.value);
    assert.equal(menu.menu.value.x, 12);
    assert.equal(menu.menu.value.y, 34);
    assert.equal(menu.menu.value.target.kind, "table");
  });

  it("useContextMenu closes the menu", () => {
    const menu = useContextMenu();

    menu.open(12, 34, { kind: "canvas" });
    menu.close();

    assert.equal(menu.menu.value, null);
  });
});

