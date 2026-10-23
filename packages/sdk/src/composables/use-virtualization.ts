import { computed, type ComputedRef, type Ref } from "vue";

/** An element of the canvas that can be culled. */
export interface VirtualizableElement {
  id: string | number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** The part of the canvas that is visible, in the coordinates of the canvas. */
export interface VirtualViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VirtualizationOptions {
  /**
   * The area around the viewport that stays visible, in the units of the
   * canvas. A value of zero culls every element that lies outside of the
   * viewport.
   */
  overscan?: number;
}

export interface VirtualizationApi<T extends VirtualizableElement> {
  /** The elements that lie inside of the viewport. */
  visibleElements: ComputedRef<T[]>;
  /** The number of the elements that lie inside of the viewport. */
  visibleCount: ComputedRef<number>;
  /** The number of all the elements. */
  totalCount: ComputedRef<number>;
}

/**
 * Cull the elements of the canvas that lie outside of the viewport.
 *
 * The composable is the heart of the virtualization of the canvas: the canvas
 * only draws the elements that are visible, so that a diagram with thousands
 * of tables stays fast.
 */
export function useVirtualization<T extends VirtualizableElement>(
  elements: Readonly<Ref<T[]>>,
  viewport: Readonly<Ref<VirtualViewport>>,
  options: VirtualizationOptions = {},
): VirtualizationApi<T> {
  const overscan = options.overscan ?? 0;

  const visibleElements = computed(() => {
    const view = viewport.value;
    const left = view.x - overscan;
    const top = view.y - overscan;
    const right = view.x + view.width + overscan;
    const bottom = view.y + view.height + overscan;

    return elements.value.filter((element) => {
      const width = element.width ?? 0;
      const height = element.height ?? 0;
      return (
        element.x < right &&
        element.x + width > left &&
        element.y < bottom &&
        element.y + height > top
      );
    });
  });

  return {
    visibleElements,
    visibleCount: computed(() => visibleElements.value.length),
    totalCount: computed(() => elements.value.length),
  };
}
