import { getCurrentScope, onBeforeUnmount, ref, type Ref } from "vue";

/**
 * The full screen mode of the editor.
 *
 * The state follows the document, so that it stays correct when the user
 * leaves the full screen with the escape key. A request that is refused —
 * the browser may deny it without a gesture — keeps the state off.
 */
export function useFullscreen(target?: Ref<HTMLElement | null>): {
  isFullscreen: Ref<boolean>;
  toggle: () => Promise<void>;
} {
  const isFullscreen = ref(
    typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false,
  );

  function sync(): void {
    isFullscreen.value = Boolean(document.fullscreenElement);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("fullscreenchange", sync);
    if (getCurrentScope()) {
      onBeforeUnmount(() => {
        document.removeEventListener("fullscreenchange", sync);
      });
    }
  }

  async function toggle(): Promise<void> {
    const element =
      target?.value ??
      (typeof document !== "undefined" ? document.documentElement : null);
    if (!element) {
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      sync();
      return;
    }
    sync();
  }

  return { isFullscreen, toggle };
}
