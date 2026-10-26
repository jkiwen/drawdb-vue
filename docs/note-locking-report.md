# The note that could not be unlocked

A note on the canvas could be locked, but a locked note could not be unlocked
any more. The lock was a one way street: the user locked the note to keep it
safe, and the note was then frozen for good.

This document records the cause, the fix and the contract that the lock of a
note follows now.

## The commits

| Commit | Content |
|---|---|
| _uncommitted_ | The button that unlocks a note, the cursor of the button of a locked note and the tests of the lock |

## The cause

`Note.vue` rendered the button that locks the note only when the note was not
locked:

```vue
<button
  v-if="!locked"
  class="ddb-note__lock"
  ...
>
  {{ locked ? "🔒" : "🔓" }}
</button>
```

The `v-if` and the text of the button contradict each other: the button is
written to show a lock or an open lock, but the condition removes it exactly
when the note is locked, which is the only moment the open lock has to be
shown. Locking the note therefore removed the button that unlocked it, and the
note was locked for good.

The condition was probably meant for the field of the content, which really
has to disappear when the note is locked: a locked note shows its content as
plain text instead of a text area, and the handle of the resize disappears with
it. The lock button was put under the same condition by mistake.

The table does not have the bug: `TableHeader.vue` renders the lock button
without a condition, and it shows `🔒` or `🔓` depending on the state of the
table.

The context menu of the canvas has no entry for a note, so the button of the
note is the only way to lock a note — and it was the only way to unlock it
too.

## The fix

The condition is gone from the lock button, the way the button of a table is
written:

```vue
<button
  class="ddb-note__lock"
  type="button"
  :data-testid="`note-lock-toggle-${note.id}`"
  :title="locked ? 'Unlock the note' : 'Lock the note'"
  @pointerdown.stop
  @click="onToggleLock"
>
  {{ locked ? "🔒" : "🔓" }}
</button>
```

The pointer of the button stops the event, so the press does not reach the
note, which does not move when the note is locked, and does not reach the
canvas, which would clear the selection.

The body of a locked note has the cursor `default`, because the note cannot
be moved or written in. The button of the lock gets the cursor of a button
back, so that the user sees that the button is still live.

## The contract

* A note can be locked from the canvas.
* A locked note still shows the button of the lock, and the button unlocks it.
* An unlocked note can be written in again, and its title can be written.
* The lock of a note is one entry of the history, so it can be undone.

## The verification

| Check | Result |
|---|---|
| `pnpm typecheck` | The five projects compile without an error |
| `pnpm test` | 727 tests pass, 0 fail |
| `pnpm --filter @drawdb/core run build` | The core builds |
| `pnpm --filter @drawdb/vue-sdk run build` | The SDK builds: 45 components, 51 locales, 4 stylesheets |

The new tests of `Canvas/note-editing.test.ts`:

* a note can be locked from the canvas;
* a locked note can be unlocked from the canvas;
* a note that was unlocked can be written in again;
* the lock of a note can be undone.
