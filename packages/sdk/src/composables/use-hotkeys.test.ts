import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHotkeyRegistry, normalizeBinding } from "./use-hotkeys.ts";

function keyEvent(
  key: string,
  modifiers: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {},
) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  };
}

describe("use-hotkeys", () => {
  it("normalises a binding into its parts", () => {
    const parsed = normalizeBinding("mod+shift+Z");

    assert.equal(parsed.key, "z");
    assert.equal(parsed.mod, true);
    assert.equal(parsed.shift, true);
    assert.equal(parsed.alt, false);
    assert.equal(parsed.ctrl, false);
    assert.equal(parsed.meta, false);
  });

  it("resolves the mod modifier against the platform", () => {
    const mac = createHotkeyRegistry("darwin");
    const windows = createHotkeyRegistry("win32");
    let macCalls = 0;
    let windowsCalls = 0;

    mac.register("mod+k", () => {
      macCalls += 1;
    });
    windows.register("mod+k", () => {
      windowsCalls += 1;
    });

    assert.equal(mac.handle(keyEvent("k", { metaKey: true })), true);
    assert.equal(mac.handle(keyEvent("k", { ctrlKey: true })), false);

    assert.equal(windows.handle(keyEvent("k", { ctrlKey: true })), true);
    assert.equal(windows.handle(keyEvent("k", { metaKey: true })), false);

    assert.equal(macCalls, 1);
    assert.equal(windowsCalls, 1);
  });

  it("runs the handler of a matching binding", () => {
    const registry = createHotkeyRegistry("win32");
    let calls = 0;

    registry.register("mod+z", () => {
      calls += 1;
    });

    const handled = registry.handle(keyEvent("z", { ctrlKey: true }));
    assert.equal(handled, true);
    assert.equal(calls, 1);
  });

  it("ignores a binding whose modifiers do not match", () => {
    const registry = createHotkeyRegistry("win32");
    let calls = 0;

    registry.register("mod+z", () => {
      calls += 1;
    });

    const handled = registry.handle(
      keyEvent("z", { ctrlKey: true, shiftKey: true }),
    );
    assert.equal(handled, false);
    assert.equal(calls, 0);
  });

  it("ignores a binding whose key does not match", () => {
    const registry = createHotkeyRegistry("win32");
    let calls = 0;

    registry.register("mod+z", () => {
      calls += 1;
    });

    assert.equal(registry.handle(keyEvent("y", { ctrlKey: true })), false);
    assert.equal(calls, 0);
  });

  it("supports several handlers for one binding", () => {
    const registry = createHotkeyRegistry("win32");
    const calls: string[] = [];

    registry.register("delete", () => calls.push("first"));
    registry.register("delete", () => calls.push("second"));

    registry.handle(keyEvent("Delete"));
    assert.deepEqual(calls, ["first", "second"]);
  });

  it("unregisters a handler", () => {
    const registry = createHotkeyRegistry("win32");
    let calls = 0;

    registry.register("escape", () => {
      calls += 1;
    });
    registry.unregister("escape");

    assert.equal(registry.handle(keyEvent("Escape")), false);
    assert.equal(calls, 0);
  });

  it("runs the handlers in priority order", () => {
    const registry = createHotkeyRegistry("win32");
    const calls: string[] = [];

    registry.register("mod+s", () => calls.push("low"), { priority: 1 });
    registry.register("mod+s", () => calls.push("high"), { priority: 10 });

    registry.handle(keyEvent("s", { ctrlKey: true }));
    assert.deepEqual(calls, ["high", "low"]);
  });

  it("stops running the handlers once one of them prevents the default", () => {
    const registry = createHotkeyRegistry("win32");
    const calls: string[] = [];

    registry.register("mod+s", (event) => {
      calls.push("first");
      event.preventDefault?.();
    });
    registry.register("mod+s", () => calls.push("second"));

    registry.handle(keyEvent("s", { ctrlKey: true }));
    assert.deepEqual(calls, ["first"]);
  });
});
