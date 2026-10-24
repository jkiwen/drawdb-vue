export interface CanvasEventHandlers {
  onPointerDown?: (event: PointerEvent) => void;
  onPointerMove?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
  onPointerCancel?: (event: PointerEvent) => void;
  onWheel?: (event: WheelEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export interface CanvasEventsOptions extends CanvasEventHandlers {
  /** Throttles the pointer move handling to one call per animation frame. */
  throttle?: boolean;
}

export interface CanvasEventsApi {
  /** Attaches the handlers to an element and returns the detach function. */
  attach(target: EventTarget): () => void;
  detach(): void;
  readonly attached: boolean;
  /** Runs the pending throttled event right away. */
  flush(): void;
}

type FrameScheduler = (callback: () => void) => number;
type FrameCanceller = (handle: number) => void;

function frameScheduler(): FrameScheduler {
  const globalAny = globalThis as {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  };
  if (typeof globalAny.requestAnimationFrame === "function") {
    return (callback) => globalAny.requestAnimationFrame?.(() => callback()) as number;
  }
  return (callback) => setTimeout(callback, 16) as unknown as number;
}

function frameCanceller(): FrameCanceller {
  const globalAny = globalThis as {
    cancelAnimationFrame?: (handle: number) => void;
  };
  if (typeof globalAny.cancelAnimationFrame === "function") {
    return (handle) => globalAny.cancelAnimationFrame?.(handle);
  }
  return (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

/**
 * Binds the pointer and wheel events of the canvas.
 *
 * Pointer moves are the most frequent event of the canvas, so they are
 * throttled to one call per animation frame; the last event of a frame is the
 * one that is delivered.
 */
export function useCanvasEvents(
  options: CanvasEventsOptions = {},
): CanvasEventsApi {
  const schedule = frameScheduler();
  const cancel = frameCanceller();

  let target: EventTarget | null = null;
  let pendingEvent: PointerEvent | null = null;
  let frameHandle: number | null = null;

  function flush(): void {
    if (!pendingEvent) {
      return;
    }
    const event = pendingEvent;
    pendingEvent = null;
    frameHandle = null;
    options.onPointerMove?.(event);
  }

  function scheduleFlush(): void {
    if (frameHandle !== null) {
      return;
    }
    frameHandle = schedule(() => {
      frameHandle = null;
      flush();
    });
  }

  function handlePointerMove(event: PointerEvent): void {
    if (options.throttle === false) {
      options.onPointerMove?.(event);
      return;
    }
    pendingEvent = event;
    scheduleFlush();
  }

  const listeners: Array<[string, EventListener]> = [
    ["pointerdown", (event) => options.onPointerDown?.(event as PointerEvent)],
    ["pointermove", handlePointerMove as EventListener],
    [
      "pointerup",
      (event) => {
        // The move that waits for the next frame is the move the user
        // released the pointer on, so it is delivered before the release.
        flush();
        options.onPointerUp?.(event as PointerEvent);
      },
    ],
    [
      "pointercancel",
      (event) => options.onPointerCancel?.(event as PointerEvent),
    ],
    ["wheel", (event) => options.onWheel?.(event as WheelEvent)],
    ["contextmenu", (event) => options.onContextMenu?.(event as MouseEvent)],
    ["dblclick", (event) => options.onDoubleClick?.(event as MouseEvent)],
    ["keydown", (event) => options.onKeyDown?.(event as KeyboardEvent)],
  ];

  /**
   * The end of a gesture that the user finishes outside of the canvas.
   *
   * The events of the element only reach the canvas while the pointer is over
   * it, so a table that is dragged and released over a panel of the editor
   * would keep a gesture that never ends. The window sees that release; the
   * element delivers its own events first, so the ones the canvas has already
   * handled are skipped here.
   */
  function handleRelease(event: Event): void {
    const released = event as PointerEvent;
    const inside =
      target instanceof Node &&
      released.target instanceof Node &&
      target.contains(released.target);
    if (inside) {
      return;
    }
    if (released.type === "pointercancel") {
      options.onPointerCancel?.(released);
      return;
    }
    // The release of a drag that ends outside of the canvas ends the gesture
    // where the pointer left the canvas.
    flush();
    options.onPointerUp?.(released);
  }

  const windowListeners: Array<[string, EventListener]> = [
    ["pointerup", handleRelease],
    ["pointercancel", handleRelease],
  ];

  function attach(next: EventTarget): () => void {
    detach();
    target = next;
    for (const [name, listener] of listeners) {
      target.addEventListener(name, listener);
    }
    if (typeof window !== "undefined") {
      for (const [name, listener] of windowListeners) {
        window.addEventListener(name, listener);
      }
    }
    return detach;
  }

  function detach(): void {
    if (target) {
      for (const [name, listener] of listeners) {
        target.removeEventListener(name, listener);
      }
      target = null;
    }
    if (typeof window !== "undefined") {
      for (const [name, listener] of windowListeners) {
        window.removeEventListener(name, listener);
      }
    }
    if (frameHandle !== null) {
      cancel(frameHandle);
      frameHandle = null;
    }
    pendingEvent = null;
  }

  return {
    attach,
    detach,
    get attached() {
      return target !== null;
    },
    flush,
  };
}
