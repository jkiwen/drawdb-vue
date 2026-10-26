import type { Metadata } from "./metadata.ts";

export type AreaId = string | number;

export interface Area {
  id: AreaId;
  name: string;
  /** A short text that describes what the area groups. */
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
  color?: string;
  /**
   * The opacity of the background fill, from 0 to 1.
   *
   * The stroke of the area keeps the full color, only the fill is softened,
   * so that the tables the area holds stay readable. An area without the
   * opacity is drawn with the default of `0.08`.
   */
  opacity?: number;
  /**
   * Whether the area is collapsed to its title bar.
   *
   * The collapse is a property of the area itself and not of the viewport, so
   * it is saved with the diagram and survives a round trip of the JSON the
   * way the color does. A collapsed area keeps the size it had: the canvas
   * draws the title bar only, and expanding the area brings the size back.
   */
  collapsed?: boolean;
  metadata?: Metadata;
}

/** The longest name an area may have. */
export const AREA_NAME_MAX_LENGTH = 100;

/** The longest description an area may have. */
export const AREA_DESCRIPTION_MAX_LENGTH = 500;

/** The rules the name and the description of an area can break. */
export type AreaPropsIssueCode =
  | "name_required"
  | "name_too_long"
  | "description_too_long";

/**
 * Checks the name and the description of an area.
 *
 * Only the provided fields are checked, so that a partial update can send
 * just the field it changes. A name has to be non-empty once the surrounding
 * whitespace is trimmed. The check returns the code of every broken rule, an
 * empty array means the properties are valid.
 */
export function validateAreaProps(props: {
  name?: string;
  description?: string;
}): AreaPropsIssueCode[] {
  const issues: AreaPropsIssueCode[] = [];
  if (props.name !== undefined) {
    if (props.name.trim().length === 0) {
      issues.push("name_required");
    } else if (props.name.trim().length > AREA_NAME_MAX_LENGTH) {
      issues.push("name_too_long");
    }
  }
  if (
    props.description !== undefined &&
    props.description.length > AREA_DESCRIPTION_MAX_LENGTH
  ) {
    issues.push("description_too_long");
  }
  return issues;
}
