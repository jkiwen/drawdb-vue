import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { Note } from "@drawdb/core";
import { useDiagramStore } from "../../stores/diagram.ts";
import { useHistoryStore } from "../../stores/history.ts";
import Canvas from "./Canvas.vue";
import { naive } from "../../../../../scripts/naive-ui-mock.mjs";

/**
 * The note on the canvas.
 *
 * A note has to be usable the way the reference application lets the user use
 * it: it can be dragged, it can be resized and the user can write in it.
 * The specs mount the canvas and drive it with the events of a pointer, so
 * that the whole way from the note to the diagram is covered.
 */

function seed(pinia: Pinia) {
  setActivePinia(pinia);
  const diagram = useDiagramStore(pinia);

  diagram.addEntity("notes", {
    id: "note1",
    title: "Note",
    content: "Something to remember",
    x: 120,
    y: 200,
    width: 220,
    height: 120,
  } as Note);

  return diagram;
}

function freshPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

function mountCanvas(pinia: Pinia) {
  return mount(Canvas, {
    props: { width: 1200, height: 800 },
    global: { plugins: [pinia, naive] },
    // The canvas has to be on the page: it listens on the element it is
    // mounted on, so the spec drives the events of the pointer on it.
    attachTo: document.body,
  });
}

/** Dispatches a pointer event, the way a browser does. */
function fire(
  element: Element,
  type: string,
  init: { clientX?: number; clientY?: number } = {},
): void {
  element.dispatchEvent(
    new window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
      button: 0,
    }),
  );
}



/** Waits for the throttled pointer move of the canvas. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40));
}

describe("the note on the canvas", () => {
  it("is drawn with its content", async () => {
    const pinia = freshPinia();
    seed(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const note = wrapper.find('[data-testid="note-note1"]');
    assert.ok(note.exists(), "the note should be drawn");
    assert.equal(note.find('[data-testid="note-title-note1"]').text(), "Note");
    // The content of the note is written in the note itself, so the area that
    // holds it carries the content of the diagram.
    const area = note.find('[data-testid="note-content-note1"]');
    assert.ok(area.exists(), "the note needs an editable area");
    assert.equal(
      (area.element as HTMLTextAreaElement).value,
      "Something to remember",
    );
  });

  it("can be dragged", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const note = wrapper.find('[data-testid="note-note1"]').element;
    fire(note, "pointerdown", { clientX: 200, clientY: 260 });
    await settle();

    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointermove",
      { clientX: 260, clientY: 320 },
    );
    await settle();

    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointerup",
      { clientX: 260, clientY: 320 },
    );
    await nextTick();

    assert.equal(diagram.notes[0].x, 180);
    assert.equal(diagram.notes[0].y, 260);
  });

  it("the drag of a note can be undone", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const history = useHistoryStore(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const note = wrapper.find('[data-testid="note-note1"]').element;
    fire(note, "pointerdown", { clientX: 200, clientY: 260 });
    await settle();
    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointermove",
      { clientX: 260, clientY: 320 },
    );
    await settle();
    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointerup",
      { clientX: 260, clientY: 320 },
    );
    await nextTick();

    assert.equal(history.canUndo, true);
    history.undo();
    await nextTick();
    assert.equal(diagram.notes[0].x, 120);
  });

  it("can be resized with its handle", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const handle = wrapper.find('[data-testid="note-resize-handle-note1"]');
    assert.ok(handle.exists(), "the note needs a resize handle");

    fire(handle.element, "pointerdown", { clientX: 340, clientY: 320 });
    await settle();
    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointermove",
      { clientX: 400, clientY: 380 },
    );
    await settle();
    fire(
      wrapper.find('[data-testid="canvas"]').element,
      "pointerup",
      { clientX: 400, clientY: 380 },
    );
    await nextTick();

    assert.equal(diagram.notes[0].width, 280);
    assert.equal(diagram.notes[0].height, 180);
  });

  it("the content of a note can be written", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    const area = wrapper.find('[data-testid="note-content-note1"]');
    assert.ok(area.exists(), "the note needs an editable area");

    const el = area.element as HTMLTextAreaElement;
    el.value = "A new content";
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    await nextTick();

    // The text is written into the diagram when the field loses the focus, so
    // that the history holds one entry for the whole text.
    el.dispatchEvent(new window.Event("blur", { bubbles: false }));
    await nextTick();

    assert.equal(diagram.notes[0].content, "A new content");
  });

  it("the title of a note can be written", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    const wrapper = mountCanvas(pinia);
    await nextTick();

    // The title is written in the note itself: a double click opens it.
    const title = wrapper.find('[data-testid="note-title-note1"]').element;
    title.dispatchEvent(
      new window.MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    await nextTick();

    const input = wrapper.find('[data-testid="note-title-input-note1"]');
    assert.ok(input.exists(), "the note needs an editable title");

    const el = input.element as HTMLInputElement;
    el.value = "A better title";
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
    el.dispatchEvent(new window.Event("blur", { bubbles: false }));
    await nextTick();

    assert.equal(diagram.notes[0].title, "A better title");
  });

  it("a locked note cannot be edited", async () => {
    const pinia = freshPinia();
    const diagram = seed(pinia);
    diagram.addEntity("notes", {
      id: "note2",
      title: "Locked",
      content: "",
      x: 400,
      y: 400,
      width: 200,
      height: 100,
      locked: true,
    } as Note);
    await nextTick();

    const wrapper = mountCanvas(pinia);
    await nextTick();

    assert.equal(
      wrapper.find('[data-testid="note-note2"] [data-testid="note-content-note2"]').exists(),
      false,
      "a locked note must not offer an editable area",
    );
    assert.equal(
      wrapper.find('[data-testid="note-note1"] [data-testid="note-content-note1"]').exists(),
      true,
      "a note that is not locked can be written in",
    );
  });
});
