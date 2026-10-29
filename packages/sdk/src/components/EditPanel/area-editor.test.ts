import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createEmptyDiagram } from "@drawdb/core";
import EditPanel from "./EditPanel.vue";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useUIStore } from "../../stores/ui.ts";
import {
  MIN_AREA_HEIGHT,
  MIN_AREA_WIDTH,
} from "../Canvas/interactions/use-resize.ts";

function mountAreaPanel(area: {
  id: string;
  name: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  locked?: boolean;
}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const diagram = useDiagramStore();
  const ui = useUIStore();
  const empty = createEmptyDiagram();
  diagram.setDiagram({ ...empty, subjectAreas: [area] });
  ui.selectArea(area.id);
  const wrapper = mount(EditPanel, {
    global: { plugins: [pinia] },
  });
  return { wrapper, diagram, ui };
}

async function setInput(
  wrapper: ReturnType<typeof mount>,
  testid: string,
  value: string,
): Promise<void> {
  const element = wrapper.find(`[data-testid="${testid}"]`);
  assert.ok(element.exists(), `expected ${testid} to exist`);
  await element.setValue(value);
  await element.trigger("change");
  await element.trigger("blur");
}

describe("the editor of an area", () => {
  it("shows every property of an area, not only its name", () => {
    const { wrapper } = mountAreaPanel({
      id: "a1",
      name: "Sales",
      description: "The selling side",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      color: "#ffcc00",
      opacity: 0.2,
      locked: true,
    });

    for (const testid of [
      "area-name",
      "area-description",
      "area-color",
      "area-opacity",
      "area-width",
      "area-height",
      "area-locked",
    ]) {
      assert.ok(
        wrapper.find(`[data-testid="${testid}"]`).exists(),
        `expected the panel to edit ${testid}`,
      );
    }
    assert.equal(
      (wrapper.find('[data-testid="area-description"]').element as HTMLTextAreaElement).value,
      "The selling side",
    );
    assert.equal(
      (wrapper.find('[data-testid="area-opacity"]').element as HTMLInputElement).value,
      "0.2",
    );
    assert.equal(
      (wrapper.find('[data-testid="area-locked"]').element as HTMLInputElement).checked,
      true,
    );
  });

  it("writes the description, the colour, the size and the lock", async () => {
    const { wrapper, diagram } = mountAreaPanel({
      id: "a1",
      name: "Sales",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });

    await setInput(wrapper, "area-description", "The selling side");
    await setInput(wrapper, "area-opacity", "0.5");
    await setInput(wrapper, "area-width", "420");
    await setInput(wrapper, "area-height", "260");

    const area = diagram.diagram.subjectAreas?.[0];
    assert.ok(area !== undefined);
    assert.equal(area.description, "The selling side");
    assert.equal(area.opacity, 0.5);
    assert.equal(area.width, 420);
    assert.equal(area.height, 260);
  });

  it("keeps the smallest size the canvas allows", async () => {
    const { wrapper, diagram } = mountAreaPanel({
      id: "a1",
      name: "Sales",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });

    await setInput(wrapper, "area-width", "10");
    await setInput(wrapper, "area-height", "10");

    const area = diagram.diagram.subjectAreas?.[0];
    assert.ok(area !== undefined);
    assert.equal(area.width, MIN_AREA_WIDTH);
    assert.equal(area.height, MIN_AREA_HEIGHT);
  });

  it("does not let the name become empty", async () => {
    const { wrapper, diagram } = mountAreaPanel({
      id: "a1",
      name: "Sales",
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });

    await setInput(wrapper, "area-name", "   ");

    assert.equal(diagram.diagram.subjectAreas?.[0]?.name, "Sales");
  });
});
