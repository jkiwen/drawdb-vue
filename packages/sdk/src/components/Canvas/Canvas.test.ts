import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import Canvas from "./Canvas.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

async function render(pinia: ReturnType<typeof createPinia>) {
  const app = createSSRApp(Canvas, { width: 1200, height: 800 });
  app.use(pinia);
  app.use(naive);
  return renderToString(app);
}

function seed() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore(pinia);

  diagram.addTable({
    id: "users",
    name: "users",
    x: 40,
    y: 60,
    logical: {
      id: "l_users",
      name: "users",
      attributes: [
        { id: "a_users_id", name: "id", logicalType: { family: "integer" }, fieldId: "users_id" },
        { id: "a_users_name", name: "name", logicalType: { family: "string" }, fieldId: "users_name" },
      ],
    },
    fields: [
      { id: "users_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true, notNull: true },
      { id: "users_name", name: "name", fieldType: { type: "VARCHAR", length: 255 }, fieldTypeSource: "explicit" },
    ],
  });

  diagram.addTable({
    id: "posts",
    name: "posts",
    x: 420,
    y: 60,
    logical: {
      id: "l_posts",
      name: "posts",
      attributes: [
        { id: "a_posts_id", name: "id", logicalType: { family: "integer" }, fieldId: "posts_id" },
        { id: "a_posts_user_id", name: "user_id", logicalType: { family: "integer" }, fieldId: "posts_user_id" },
      ],
    },
    fields: [
      { id: "posts_id", name: "id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit", primary: true },
      { id: "posts_user_id", name: "user_id", fieldType: { type: "INTEGER" }, fieldTypeSource: "explicit" },
    ],
  });

  diagram.addRelationship({
    id: "rel_posts_users",
    startTableId: "posts",
    startFieldId: "posts_user_id",
    endTableId: "users",
    endFieldId: "users_id",
    name: "fk_posts_users",
    cardinality: "many_to_one",
  });

  diagram.diagram.notes.push({
    id: "note-1",
    x: 40,
    y: 400,
    title: "Heads up",
    content: "A note",
  });

  diagram.diagram.areas = [
    { id: "area-1", name: "users area", x: 20, y: 20, width: 300, height: 200 },
  ];

  diagram.diagram.views.push({
    id: "view-1",
    name: "active_users",
    x: 700,
    y: 400,
    width: 240,
    baseTableId: "users",
  });

  return { pinia, diagram };
}

describe("Canvas", () => {
  it("renders an svg root", async () => {
    const { pinia } = seed();
    const html = await render(pinia);
    assert.ok(html.includes("data-testid=\"canvas\""));
    assert.ok(html.includes("<svg"));
  });

  it("renders a table with its name and fields", async () => {
    const { pinia } = seed();
    const html = await render(pinia);
    assert.ok(html.includes("data-testid=\"table-users\""));
    assert.ok(html.includes("users"));
    assert.ok(html.includes("data-testid=\"field-users-users_name\""));
    assert.ok(html.includes("VARCHAR"));
  });

  it("renders a relationship between two tables", async () => {
    const { pinia } = seed();
    const html = await render(pinia);
    assert.ok(html.includes("data-testid=\"relationship-rel_posts_users\""));
    assert.ok(html.includes("<path"));
  });

  it("renders notes, areas and views", async () => {
    const { pinia } = seed();
    const html = await render(pinia);
    assert.ok(html.includes("data-testid=\"note-note-1\""));
    assert.ok(html.includes("data-testid=\"area-area-1\""));
    assert.ok(html.includes("data-testid=\"view-view-1\""));
  });

  it("hides the elements that are outside of the viewport", async () => {
    const { pinia, diagram } = seed();
    diagram.addTable({
      id: "far_away",
      name: "far_away",
      x: 9000,
      y: 9000,
      logical: { id: "l_far_away", name: "far_away", attributes: [] },
      fields: [],
    });

    const html = await render(pinia);
    assert.ok(html.includes("data-testid=\"table-users\""));
    assert.ok(!html.includes("data-testid=\"table-far_away\""));
  });

  it("applies the zoom to the content group", async () => {
    const { pinia } = seed();
    const ui = useUIStore(pinia);
    ui.setZoom(2);

    const html = await render(pinia);
    assert.ok(html.includes("scale(2)"));
  });
});
