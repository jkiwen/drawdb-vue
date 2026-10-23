import { test } from "node:test";
import assert from "node:assert/strict";
import { ref } from "vue";
import { useVirtualization } from "./use-virtualization.ts";

test("culls the elements that lie outside of the viewport", () => {
  const elements = ref([
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 5000, y: 5000, width: 100, height: 100 },
  ]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements } = useVirtualization(elements, viewport);

  assert.deepEqual(
    visibleElements.value.map((element) => element.id),
    ["a"],
  );
});

test("follows the viewport", () => {
  const elements = ref([
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 5000, y: 5000, width: 100, height: 100 },
  ]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements, visibleCount, totalCount } = useVirtualization(
    elements,
    viewport,
  );

  assert.equal(visibleCount.value, 1);
  assert.equal(totalCount.value, 2);

  viewport.value = { x: 4900, y: 4900, width: 1000, height: 1000 };

  assert.deepEqual(
    visibleElements.value.map((element) => element.id),
    ["b"],
  );
});

test("keeps the elements that end at the border of the viewport", () => {
  const elements = ref([
    { id: "edge", x: 900, y: 900, width: 100, height: 100 },
    { id: "outside", x: 1000, y: 900, width: 100, height: 100 },
  ]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements } = useVirtualization(elements, viewport);

  assert.deepEqual(
    visibleElements.value.map((element) => element.id),
    ["edge"],
  );
});

test("keeps a margin around the viewport", () => {
  const elements = ref([
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
    { id: "b", x: 1500, y: 0, width: 100, height: 100 },
  ]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements } = useVirtualization(elements, viewport, {
    overscan: 600,
  });

  assert.deepEqual(
    visibleElements.value.map((element) => element.id),
    ["a", "b"],
  );
});

test("treats an element without a size as a point", () => {
  const elements = ref([
    { id: "inside", x: 10, y: 10 },
    { id: "outside", x: 5000, y: 5000 },
  ]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements } = useVirtualization(elements, viewport);

  assert.deepEqual(
    visibleElements.value.map((element) => element.id),
    ["inside"],
  );
});

test("follows the elements", () => {
  const elements = ref<{ id: string; x: number; y: number; width: number; height: number }[]>([]);
  const viewport = ref({ x: 0, y: 0, width: 1000, height: 1000 });

  const { visibleElements, totalCount } = useVirtualization(elements, viewport);

  assert.equal(totalCount.value, 0);
  assert.equal(visibleElements.value.length, 0);

  elements.value = [
    { id: "a", x: 0, y: 0, width: 100, height: 100 },
  ];

  assert.equal(totalCount.value, 1);
  assert.equal(visibleElements.value.length, 1);
});
