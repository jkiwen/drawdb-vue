# The visual parity with the React reference

The canvas of the SDK did not look like the canvas of drawDB: the tables had no
border, the fields were squeezed together and the relationships crossed the
tables. The cause was simple and total: **the SDK had no stylesheet at all**.
The class names (`ddb-table__body`, `ddb-table__row`, `ddb-table__field`, …)
existed in the templates only, so the browser drew unstyled `div` elements.

This document records the work that aligned the canvas with the reference
application, and the decisions that came with it.

## The commits

| Commit | Content |
|---|---|
| `ef82717` | The stylesheet of the canvas, the routing of the relationships, the cardinality as a label |
| `891b59d` | The marks of the fields, the colours of the types, the height of the comment |

## The stylesheet of the canvas

`packages/sdk/src/components/Canvas/canvas.css` is the first stylesheet of the
SDK (about 640 lines). It is **not scoped**: the canvas draws SVG nodes next to
HTML nodes, and a scoped attribute would not reach the nodes that Vue renders
from a string (the render function of a compiled template).

The prefix `ddb-` keeps the rules of the SDK apart from the rules of the host
application. The import happens in the root of the canvas
(`Canvas.vue` imports `./canvas.css`), so every node of the canvas is styled.

What it draws:

- the dotted background of the canvas (`radial-gradient(rgb(118,118,209) 1px, #fff 1px)` with a `background-size` of 20px)
- the table: a 2px border, a radius of 8px, a background of `#f4f4f5`, a drop shadow, a dashed blue border on hover and a solid blue border when it is selected
- the header of the table: a bottom border, the colour strip, the name in bold and the comment in a smaller font
- the rows of the fields: a height of 36px, a bottom border, a blue grip of 10px on the left, the type in a monospace font
- the relationship: a grey stroke of 2.5px that becomes a blue dashed line with the animation `ddb-dash-right` on hover
- the areas, the notes, the views, the minimap, the link preview and the selection box

The loader of the test runner answers a `.css` import with an empty module
(`scripts/sfc-loader.mjs`), because Node cannot parse a stylesheet and the
specifications check the structure of the canvas and not its look. The build
(`scripts/build-sdk.mjs`) copies the stylesheets into `dist` and rewrites their
specifiers.

## The routing of the relationships

`relationshipPath` drew a cubic bezier whose control points assumed that the
start of the relationship stands on the left of its end. But the anchors of a
relationship are the sides that face each other, so the start of a relation
between a table on the right and a table on the left sits on the **right** of
the coordinates of the curve: the line crossed the tables.

The path chooses the direction of its control points from the position of the
two anchors, and not from the order of the relationship.

The reference application does something else: it draws an orthogonal path with
rounded corners (`src/utils/calcPath.js`), with a case for each relative
position of the two tables. The bezier of the SDK is simpler and reads well,
but a diagram whose tables overlap may still route the line across them.

## The cardinality as a label

The reference application draws the cardinality as a label on a rounded
background (`1` or `n`), and not as a tick or a crow's foot. The SDK now does
the same: `cardinality.ts` exports `cardinalityText`, and `Relationship.vue` and
`LogicalRelationship.vue` draw a `<rect rx="9">` with a `<text>`.

The old `cardinalityMarker` (the tick and the crow's foot) is kept and
exported, but no component uses it any more.

## The marks of the fields

The reference application draws the primary key as a **key icon** and marks a
nullable field with a **question mark**. The SDK drew the letters `PK` and
`NN`, which meant the opposite of the question mark of the reference (the `NN`
said that the field was not null, while the `?` of the reference says that it
accepts the null value).

`TableField.vue` now follows the reference:

- the primary key is an SVG key, shown only when the field is a primary key
- a field that accepts the null value shows a `?`
- the delete button appears only while the pointer is on the row
- the name and the marks live in two blocks (`ddb-table__field-main` and `ddb-table__field-marks`), like the reference

The tooltips of the marks are localized with the keys `primary_key` and
`nullable` of the 51 locales.

## The colours of the types

The reference application paints the types by family: the integers in yellow,
the decimals in green, the booleans in violet, the dates in cyan, the strings
in orange, the binaries in emerald, the enumerations in sky and the rest in
zinc (`src/data/constants.js`).

The core gained the classification, because the family of a type belongs to the
dialect tables and not to the canvas:

```ts
import { typeColor } from "@drawdb/core";

typeColor("INTEGER");  // "#eab308"
typeColor("VARCHAR");  // "#f97316"
```

`packages/core/src/types/registry.ts` exports `classifyTypeFamily`, `typeColor`
and `TYPE_COLORS`. The names of the dialect tables win over the heuristics: a
type that the registry knows is classified with its own metadata (a type with
quotes is a string).

## The height of the header of a table

The header of a table holds the colour strip, the name and the comment. The
constant `TABLE_HEADER_HEIGHT` (50) only covers the strip and the name, so a
table with a comment pushed its fields down while the anchors of the
relationships stayed where they were.

`packages/sdk/src/components/Canvas/table-comment.ts` measures the comment with
the rules of the reference (a line of 16px, at most 5 lines, a padding of 12px
at the bottom) and `tableHeaderHeight(table)` returns the height of the header.
`fieldAnchor` and `tableHeight` use it.

## The decisions

- **The stylesheet is not scoped.** The canvas mixes SVG and HTML, and a scoped
  attribute does not reach the nodes that a compiled template renders.
  Cost if wrong: the rules of the SDK reach the nodes of the host application
  that carry a `ddb-` class.
- **The classification of the types lives in the core.** The family of a type
  belongs to the dialect tables, and the canvas only paints it. Cost if wrong:
  the core carries a notion that belongs to the interface.
- **The bezier stays.** The reference draws an orthogonal path with rounded
  corners; the SDK keeps the curve, which is simpler and reads well, but the
  tables that overlap can still route a line across them. Cost if wrong: a
  diagram with overlapping tables shows a line that crosses a table.
- **The header height is computed, not fixed.** The comment of a table changes
  the height of its header, and the anchors have to follow. Cost if wrong: none.

## The verification

- `node --experimental-strip-types scripts/run-tests.mjs` → 533/533
- `pnpm run typecheck` → clean for the five programs
- `pnpm --filter @drawdb/vue-sdk run build` → OK
- a screenshot of `examples/vue-embed` in a real browser (Chrome through
  Playwright) confirms the look: the borders, the header, the field rows, the
  key icon, the question mark, the colours of the types, the curve of the
  relationship and the labels of its cardinality
