import { BUILTIN_FAMILIES } from "@drawdb/core";
import type {
  LogicalDomain,
  LogicalTypeRef,
  Table,
  ViewLayer,
  ViewStateToggles,
} from "@drawdb/core";
import { t } from "../../i18n/index.ts";
import {
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  fieldLabel,
  tableWidth,
} from "./geometry.ts";
import { tableDetailsHeight } from "./table-details-geometry.ts";
import {
  TABLE_COMMENT_INSET,
  TABLE_COMMENT_LINE_HEIGHT,
  TABLE_COMMENT_MAX_LINES,
  TABLE_COMMENT_PADDING_BOTTOM,
} from "./table-comment.ts";

/**
 * The render model of a table node (UI document sections 6.1, 6.2 and 6.4).
 *
 * Everything the canvas draws for a table is derived here, as pure
 * functions of the table, the view layer and the per-item display toggles,
 * so the derivation is testable without mounting a component. The display
 * modes are presets of the toggles; the canvas only ever consumes toggles.
 *
 * TODO(P2'): the `indexes` toggle is accepted but not rendered yet — the
 * index rows of the "all" mode land with the index work of P2'.
 */

/**
 * A per-table override of the display toggles.
 *
 * This is the hook the scope of a display mode (the selected tables, an
 * area, the whole canvas — Task 4 of the toolbar) plugs into: the canvas
 * applies the global toggles today, and a scoped application passes the
 * overrides of the table here.
 */
export type TableDisplayOverrides = Partial<ViewStateToggles>;

export interface TableRenderOptions {
  /**
   * The domains of the diagram, by id. TODO: the SDK has no type-scope
   * store yet, so the caller cannot resolve the diagram-scope domains;
   * until then an unknown domain id is shown as its own placeholder.
   */
  domains?: Record<string, LogicalDomain>;
  overrides?: TableDisplayOverrides;
  /** The ids of the physical fields a foreign key points from. */
  foreignFieldIds?: ReadonlySet<string>;
}

/** The label of a logical type reference. */
export interface LogicalTypeLabel {
  label: string;
  /** True when the domain id stands in for the name of an unknown domain. */
  placeholder: boolean;
}

/**
 * The label of a logical type reference: the family for a family reference,
 * the name of the domain for a domain reference — or the domain id itself
 * when the domain is not known.
 *
 * A builtin family renders the `type_family.<id>` locale key; an unknown
 * family falls back to its raw id.
 */
export function logicalTypeLabel(
  type: LogicalTypeRef,
  domains?: Record<string, LogicalDomain>,
): LogicalTypeLabel {
  if ("domainId" in type && typeof type.domainId === "string") {
    const domain = domains?.[type.domainId];
    return domain
      ? { label: domain.name, placeholder: false }
      : { label: type.domainId, placeholder: true };
  }
  const family = BUILTIN_FAMILIES.find((entry) => entry.id === type.family);
  return {
    label: family ? t(`type_family.${family.id}`) : String(type.family),
    placeholder: false,
  };
}

/** A row of the field list of a table, in either layer. */
export interface TableFieldRowModel {
  /**
   * The id the row is keyed and anchored with: the id of the physical
   * field, or of the attribute when it has no physical field.
   */
  rowId: string | number;
  /** The id of the physical field the row comes from, when it has one. */
  fieldId?: string | number;
  /** The id of the logical attribute the row comes from, in the logical layer. */
  attributeId?: string | number;
  name: string;
  /** True when the physical name stands in for a missing logical name. */
  nameFallback: boolean;
  typeLabel: string;
  /** True when the type label is the id of an unknown domain. */
  typePlaceholder: boolean;
  primary: boolean;
  unique: boolean;
  notNull: boolean;
  foreign: boolean;
}

/** The title of a table node: the name of the layer the canvas shows. */
export function tableTitle(
  table: Table,
  layer: ViewLayer,
): { text: string; fallback: boolean } {
  if (layer === "logical") {
    const logical = table.logical?.name?.trim();
    if (logical) {
      return { text: logical, fallback: false };
    }
    // Ruling of section 6.4: a missing logical name falls back to the
    // physical name, and the canvas marks it with a pale badge.
    return { text: table.name, fallback: true };
  }
  return { text: table.name, fallback: false };
}

/**
 * The description of a table in a layer: the logical description in the
 * logical layer, the physical comment in the physical one. The layers never
 * borrow from each other (invariant 2 of section 6.1).
 */
export function tableDescription(
  table: Table,
  layer: ViewLayer,
): string | undefined {
  return layer === "logical" ? table.logical?.description : table.comment;
}

/**
 * The number of lines a description takes, wrapped at the width of the
 * table — the same measure the comment of the header uses.
 */
export function descriptionLineCount(text: string, width: number): number {
  if (!text) {
    return 0;
  }
  const usable = Math.max(1, width - TABLE_COMMENT_INSET);
  // A character takes about 6px in the font of the description.
  const perLine = Math.max(1, Math.floor(usable / 6));
  const lines = text.split("\n").reduce((total, paragraph) => {
    return total + Math.max(1, Math.ceil(paragraph.length / perLine));
  }, 0);
  return Math.min(lines, TABLE_COMMENT_MAX_LINES);
}

/** The height a description adds to the header of its table. */
export function descriptionHeight(text: string, width: number): number {
  const lines = descriptionLineCount(text, width);
  if (lines === 0) {
    return 0;
  }
  return lines * TABLE_COMMENT_LINE_HEIGHT + TABLE_COMMENT_PADDING_BOTTOM;
}

/**
 * The rows of the field list of a table.
 *
 * The physical layer lists the physical fields with their type
 * specifications; the logical layer lists the attributes of the logical
 * entity with their logical type labels. An attribute without a logical
 * name falls back to the name of its physical field and is flagged for the
 * fallback badge (section 6.4).
 */
export function tableFieldRows(
  table: Table,
  layer: ViewLayer,
  options?: TableRenderOptions,
): TableFieldRowModel[] {
  if (layer === "logical") {
    return (table.logical?.attributes ?? []).map((attribute) => {
      const field = attribute.fieldId
        ? table.fields.find(
            (entry) => String(entry.id) === String(attribute.fieldId),
          )
        : undefined;
      const name = attribute.name?.trim();
      const type = logicalTypeLabel(attribute.logicalType, options?.domains);
      return {
        rowId: attribute.fieldId ?? attribute.id,
        fieldId: attribute.fieldId,
        attributeId: attribute.id,
        name: name || (field?.name ?? String(attribute.id)),
        nameFallback: !name,
        typeLabel: type.label,
        typePlaceholder: type.placeholder,
        primary: attribute.keyRole === "primary",
        unique: attribute.keyRole === "alternate",
        notNull: attribute.required === true,
        foreign: attribute.keyRole === "foreign",
      };
    });
  }
  return table.fields.map((field) => ({
    rowId: field.id,
    fieldId: field.id,
    name: field.name,
    nameFallback: false,
    typeLabel: fieldLabel(field),
    typePlaceholder: false,
    primary: field.primary === true,
    unique: field.unique === true,
    notNull: field.notNull === true,
    foreign: options?.foreignFieldIds?.has(String(field.id)) === true,
  }));
}

/** Everything the canvas needs to draw a table node. */
export interface TableRenderModel {
  layer: ViewLayer;
  title: string;
  titleFallback: boolean;
  description: string | null;
  showDescription: boolean;
  descriptionHeight: number;
  headerHeight: number;
  rows: TableFieldRowModel[];
  showFields: boolean;
  showKeyMarks: boolean;
  width: number;
  height: number;
}

/**
 * Derives what a table node draws from the table, the view layer and the
 * display toggles.
 *
 * The toggles decide the content: `description` adds the description of the
 * layer to the header (the "definition" mode), `fields` lists the fields or
 * attributes (the "attributes" mode), `pkUkFk` shows the key marks on the
 * rows (the "all" mode). Every toggle off is the "entity" mode: the title
 * bar alone.
 */
export function tableRenderModel(
  table: Table,
  layer: ViewLayer,
  toggles: ViewStateToggles,
  options?: TableRenderOptions,
): TableRenderModel {
  const effective: ViewStateToggles = { ...toggles, ...options?.overrides };
  const width = tableWidth(table);
  const title = tableTitle(table, layer);
  const description = tableDescription(table, layer) ?? null;
  const showDescription = effective.description && Boolean(description?.trim());
  const descriptionRows = showDescription && description
    ? descriptionHeight(description, width)
    : 0;
  const headerHeight = TABLE_HEADER_HEIGHT + descriptionRows;
  const rows = effective.fields ? tableFieldRows(table, layer, options) : [];
  const height = table.collapsed
    ? headerHeight
    : headerHeight + rows.length * TABLE_FIELD_HEIGHT + tableDetailsHeight(table);
  return {
    layer,
    title: title.text,
    titleFallback: title.fallback,
    description,
    showDescription,
    descriptionHeight: descriptionRows,
    headerHeight,
    rows,
    showFields: effective.fields,
    showKeyMarks: effective.pkUkFk,
    width,
    height,
  };
}

// The canvas geometry of the render model — the bounds of a table, the
// anchors of a relationship and the bounds of a relationship — lives in
// render-geometry.ts, so that this module stays the pure content model.
