import { ref, type Ref } from "vue";

export interface InlineEditApi {
  /** Whether the value is being edited at the moment. */
  editing: Ref<boolean>;
  /** The value the user is writing. */
  draft: Ref<string>;
  /** Starts the edit of a value. */
  start(value: string): void;
  /** Gives up the edit. */
  cancel(): void;
  /**
   * Ends the edit.
   *
   * Returns the new value when it differs from the value that was edited, and
   * `undefined` when the user did not change anything.
   */
  commit(current: string): string | undefined;
}

/**
 * The edit of a value in place.
 *
 * The composable holds the value the user is writing, so that the component
 * does not have to. The value of the diagram is only changed when the edit is
 * committed, and only when the value really changed.
 */
export function useInlineEdit(): InlineEditApi {
  const editing = ref(false);
  const draft = ref("");

  function start(value: string): void {
    draft.value = value;
    editing.value = true;
  }

  function cancel(): void {
    editing.value = false;
    draft.value = "";
  }

  function commit(current: string): string | undefined {
    const value = draft.value;
    editing.value = false;
    return value === current ? undefined : value;
  }

  return { editing, draft, start, cancel, commit };
}
