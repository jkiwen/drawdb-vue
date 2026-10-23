import { createPinia, getActivePinia, type Pinia } from "pinia";

/**
 * A pinia instance used when no active pinia is available.
 *
 * The composables of the SDK can be used outside of a component setup — in
 * plain unit tests, for example. Falling back to a dedicated instance keeps
 * them working there instead of throwing, while the state stays shared
 * between all such callers.
 */
const fallbackPinia = createPinia();

/** Returns the active pinia instance, or the shared fallback instance. */
export function resolvePinia(): Pinia {
  return getActivePinia() ?? fallbackPinia;
}
