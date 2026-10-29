/**
 * A piece of an imported file that could not be turned into a value (P7, Q18).
 *
 * The position is kept instead of the value, so the diagram stays valid and
 * the report can say "there was something here we did not read" rather than
 * quietly importing a table that is missing a column.
 */
export interface InvalidMarker {
  /** The object the marker belongs to: a table, an attribute or the diagram. */
  ownerId: string;
  /** Where in the file, e.g. "Entity[2]/Attribute[1]/FieldType". */
  path: string;
  /** The element or attribute name, as the file writes it. */
  sourceName: string;
  reason: "unsupported" | "unparsable" | "unknown-element" | "asymmetric";
  /** The original text, kept so a person can fix the file by hand. */
  original?: string;
}
