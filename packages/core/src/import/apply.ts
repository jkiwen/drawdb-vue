import type { Diagram } from "../models/diagram.ts";
import type { LogicalEntity } from "../models/logical.ts";
import type { PhysicalField } from "../models/physical.ts";
import type { ForeignKey, Index, PrimaryKey, Table, UniqueKey } from "../models/table.ts";
import { createId } from "../utils/id.ts";
import { mergeDiagramDomains } from "./domains.ts";
import type { ImportPlan, ImportPlanDecisions } from "./plan.ts";
import { planImport } from "./plan.ts";
import type { ImportIssue, ImportSource } from "./types.ts";

/** What applying an import produced. */
export interface ApplyImportResult {
  /** False when the plan was not ready: the diagram is then the untouched target. */
  applied: boolean;
  /** The merged document; the target is never mutated. */
  diagram: Diagram;
  /** What the merge had to say (warnings, notes). */
  issues: ImportIssue[];
  plan: ImportPlan;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalized(name: string): string {
  return name.trim().toLowerCase();
}

/** A name free among `taken`, by adding `_2`, `_3`… */
function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(normalized(name))) return name;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${name}_${index}`;
    if (!taken.has(normalized(candidate))) return candidate;
  }
  return `${name}_${createId()}`;
}

function remapField(field: PhysicalField, id: string): PhysicalField {
  return { ...field, id };
}

function remapKeyColumns<T extends Index | UniqueKey>(key: T, fieldIds: Map<string, string>): T {
  const columns = (key.columns ?? []).map((column) => ({
    ...column,
    fieldId: fieldIds.get(String(column.fieldId)) ?? column.fieldId,
  }));
  return { ...key, columns };
}

function remapPrimaryKey(key: PrimaryKey, fieldIds: Map<string, string>): PrimaryKey {
  return {
    ...key,
    columns: key.columns.map((column) => ({
      ...column,
      fieldId: fieldIds.get(String(column.fieldId)) ?? column.fieldId,
    })),
  };
}

function remapLogical(entity: LogicalEntity, fieldIds: Map<string, string>): LogicalEntity {
  return {
    ...entity,
    attributes: entity.attributes.map((attribute) => {
      if (attribute.fieldId === undefined) return attribute;
      const mapped = fieldIds.get(String(attribute.fieldId));
      return mapped === undefined ? attribute : { ...attribute, fieldId: mapped };
    }),
  };
}

/**
 * Applies the plan an `applyImport()` computed: the tables the user kept are
 * rebuilt with fresh ids, every key, relationship, foreign key and logical
 * attribute that pointed at an old id is re-pointed, and the target keeps its
 * own objects untouched. The decisions the plan carries decide how each clash
 * is settled: `skip` leaves the target's object alone, `rename` imports the
 * incoming one under a free name, `merge` folds it into the target's object,
 * `replace` lets the incoming value win.
 */
export function applyImport(
  target: Diagram,
  source: ImportSource,
  decisions: ImportPlanDecisions = {},
): ApplyImportResult {
  const plan = planImport(source, target, decisions);
  const issues: ImportIssue[] = [];
  if (plan.status !== "ready" || plan.targetKind === "new" || source.diagram === null) {
    issues.push({
      level: "error",
      code: "import.not_ready",
      path: "plan",
      message:
        plan.targetKind === "new"
          ? "An import into a new diagram starts from that new diagram, not from this one."
          : "The import still has conflicts or blocking issues to settle.",
    });
    return { applied: false, diagram: target, issues, plan };
  }

  const diagram = clone(target);
  const incoming = source.diagram;
  const actions = new Map((decisions.conflicts ?? []).map((entry) => [entry.id, entry.action]));
  const fieldActions = new Map(
    (decisions.conflicts ?? [])
      .filter((entry) => entry.id.startsWith("field:"))
      .map((entry) => [entry.id.slice("field:".length), entry.action]),
  );
  const kept = new Set(plan.tables.map(String));
  const takenNames = new Set(diagram.tables.map((table) => normalized(table.name)));
  const takenKeys = new Set<string>();
  for (const table of diagram.tables) {
    if (table.primaryKey !== undefined) takenKeys.add(normalized(table.primaryKey.name));
    for (const key of table.uniqueKeys ?? []) takenKeys.add(normalized(key.name));
    for (const key of table.indices ?? []) takenKeys.add(normalized(key.name));
  }

  const tableIds = new Map<string, string>();
  const tableFieldIds = new Map<string, Map<string, string>>();
  const relationshipIds = new Map<string, string>();
  const noteIds = new Map<string, string>();
  const areaIds = new Map<string, string>();

  // The tables first: a merged table publishes its id so the relationships of
  // the two sides can point at it.
  for (const table of incoming.tables) {
    if (!kept.has(String(table.id))) continue;
    const conflictId = `table:${normalized(table.name)}`;
    const action = actions.get(conflictId);
    const existing = diagram.tables.find((other) => normalized(other.name) === normalized(table.name));

    if (existing !== undefined && action === "merge") {
      tableIds.set(String(table.id), String(existing.id));
      const fieldIds = new Map<string, string>();
      const existingFields = new Map(existing.fields.map((field) => [normalized(field.name), field]));
      for (const field of table.fields) {
        const mine = existingFields.get(normalized(field.name));
        const sourceKey = `${normalized(table.name)}.${normalized(field.name)}`;
        if (mine === undefined) {
          const id = createId();
          fieldIds.set(String(field.id), id);
          existing.fields.push(remapField(field, id));
          continue;
        }
        fieldIds.set(String(field.id), String(mine.id));
        const columnAction = fieldActions.get(sourceKey);
        if (columnAction === "replace") {
          mine.fieldType = clone(field.fieldType);
          mine.fieldTypeSource = "imported";
          issues.push({
            level: "warning",
            code: "import.column_replaced",
            path: `Table[${table.name}]/Column[${field.name}]`,
            message: "The imported column type replaced the one the diagram held.",
          });
        } else if (columnAction === "merge" || columnAction === undefined) {
          issues.push({
            level: "info",
            code: "import.column_kept",
            path: `Table[${table.name}]/Column[${field.name}]`,
            message: "The diagram already defined this column; its own type was kept.",
          });
        }
      }
      existing.logical = remapLogical(existing.logical, fieldIds);
      tableFieldIds.set(String(table.id), fieldIds);
      continue;
    }

    const name = action === "rename" ? freeName(table.name, takenNames) : table.name;
    if (existing !== undefined && action !== "rename") {
      // A table the user left alone: its id still resolves, its content does not move.
      tableIds.set(String(table.id), String(existing.id));
      continue;
    }

    const id = createId();
    tableIds.set(String(table.id), id);
    takenNames.add(normalized(name));
    const fieldIds = new Map<string, string>();
    const fields = table.fields.map((field) => {
      const fieldId = createId();
      fieldIds.set(String(field.id), fieldId);
      return remapField(field, fieldId);
    });
    const renamed = normalized(name) !== normalized(table.name);
    tableFieldIds.set(String(table.id), fieldIds);

    const keys: { primaryKey?: PrimaryKey; uniqueKeys?: UniqueKey[]; indices?: Index[] } = {};
    if (table.primaryKey !== undefined) {
      keys.primaryKey = remapPrimaryKey(table.primaryKey, fieldIds);
      if (takenKeys.has(normalized(keys.primaryKey.name))) {
        keys.primaryKey.name = freeName(keys.primaryKey.name, takenKeys);
      }
      takenKeys.add(normalized(keys.primaryKey.name));
    }
    if (table.uniqueKeys !== undefined) {
      keys.uniqueKeys = table.uniqueKeys.map((key) => {
        const remapped = remapKeyColumns(key, fieldIds);
        const conflict = actions.get(`key:${normalized(key.name)}`);
        if (conflict === "skip") {
          issues.push({
            level: "info",
            code: "import.key_skipped",
            path: `Table[${name}]/Key[${key.name}]`,
            message: "A key whose physical name is taken was not imported.",
          });
          return undefined as unknown as UniqueKey;
        }
        remapped.name = freeName(remapped.name, takenKeys);
        takenKeys.add(normalized(remapped.name));
        return remapped;
      }).filter((key): key is UniqueKey => key !== undefined);
    }
    if (table.indices !== undefined) {
      keys.indices = table.indices.map((key) => {
        const remapped = remapKeyColumns(key, fieldIds);
        const conflict = actions.get(`key:${normalized(key.name)}`);
        if (conflict === "skip") {
          issues.push({
            level: "info",
            code: "import.key_skipped",
            path: `Table[${name}]/Key[${key.name}]`,
            message: "An index whose physical name is taken was not imported.",
          });
          return undefined as unknown as Index;
        }
        remapped.name = freeName(remapped.name, takenKeys);
        takenKeys.add(normalized(remapped.name));
        return remapped;
      }).filter((key): key is Index => key !== undefined);
    }

    const added: Table = {
      ...clone(table),
      id,
      name,
      fields,
      logical: remapLogical({ ...table.logical, id: createId() }, fieldIds),
      ...keys,
    };
    if (renamed) {
      added.logical = { ...added.logical, name: freeName(table.logical?.name ?? table.name, takenNames) };
    }
    added.foreignKeys = undefined;
    diagram.tables.push(added);
  }

  // Then the relationships: both ends must resolve, and a skipped one leaves a note.
  for (const relationship of incoming.relationships) {
    const start = tableIds.get(String(relationship.startTableId));
    const end = tableIds.get(String(relationship.endTableId));
    if (start === undefined || end === undefined) {
      issues.push({
        level: "info",
        code: "import.relationship_skipped",
        path: "Relationship",
        message: "A relationship of a table that was not imported was left out.",
      });
      continue;
    }
    const id = createId();
    relationshipIds.set(String(relationship.id), id);
    const startFields = tableFieldIds.get(String(relationship.startTableId));
    const endFields = tableFieldIds.get(String(relationship.endTableId));
    const startFieldId = startFields?.get(String(relationship.startFieldId)) ?? relationship.startFieldId;
    const endFieldId = endFields?.get(String(relationship.endFieldId)) ?? relationship.endFieldId;
    const pairs = relationship.fields?.map((pair) => ({
      startFieldId: startFields?.get(String(pair.startFieldId)) ?? pair.startFieldId,
      endFieldId: endFields?.get(String(pair.endFieldId)) ?? pair.endFieldId,
    }));
    diagram.relationships.push({
      ...clone(relationship),
      id,
      startTableId: start,
      endTableId: end,
      startFieldId,
      endFieldId,
      ...(pairs === undefined ? {} : { fields: pairs }),
    });
  }

  for (const relationship of incoming.logicalRelationships ?? []) {
    const mapped = relationshipIds.get(String(relationship.id));
    if (mapped === undefined) continue;
    diagram.logicalRelationships = [
      ...(diagram.logicalRelationships ?? []),
      { ...clone(relationship), id: mapped },
    ];
  }

  // The foreign keys live on the child table and name their relationship by id.
  for (const table of diagram.tables) {
    const incomingTable = incoming.tables.find(
      (other) => String(tableIds.get(String(other.id))) === String(table.id),
    );
    const keys: ForeignKey[] = [];
    for (const key of incomingTable?.foreignKeys ?? []) {
      const mapped = relationshipIds.get(String(key.relationshipId));
      if (mapped === undefined) continue;
      keys.push({ ...clone(key), id: createId(), relationshipId: mapped });
    }
    if (keys.length > 0) {
      table.foreignKeys = [...(table.foreignKeys ?? []), ...keys];
    }
  }

  // The notes and the areas, where the plan found names to settle.
  for (const note of incoming.notes) {
    const action = actions.get(`note:${normalized(note.title)}`);
    if (action === "skip") continue;
    const id = createId();
    noteIds.set(String(note.id), id);
    const title = action === "rename" ? freeName(note.title, new Set(diagram.notes.map((other) => normalized(other.title)))) : note.title;
    diagram.notes.push({ ...clone(note), id, title });
  }
  for (const area of incoming.areas ?? []) {
    const action = actions.get(`area:${normalized(area.name)}`);
    if (action === "skip") continue;
    const id = createId();
    areaIds.set(String(area.id), id);
    const name = action === "rename" ? freeName(area.name, new Set((diagram.areas ?? []).map((other) => normalized(other.name)))) : area.name;
    diagram.areas = [...(diagram.areas ?? []), { ...clone(area), id, name }];
  }

  // The domains: the merge already knows which parts the user ruled on.
  const domains = mergeDiagramDomains(
    diagram.domains ?? [],
    incoming.domains ?? [],
    decisions.domains ?? [],
  );
  if (domains.domains.length > 0) {
    diagram.domains = domains.domains;
  }

  // The enums and the custom types travel with the file unless the target names them.
  for (const type of incoming.types) {
    if (diagram.types.some((other) => normalized(other.name) === normalized(type.name))) {
      issues.push({ level: "info", code: "import.type_skipped", path: `Type[${type.name}]`, message: "The diagram already defines this type." });
      continue;
    }
    diagram.types.push({ ...clone(type), id: createId() });
  }
  for (const item of incoming.enums) {
    if (diagram.enums.some((other) => normalized(other.name) === normalized(item.name))) {
      issues.push({ level: "info", code: "import.enum_skipped", path: `Enum[${item.name}]`, message: "The diagram already defines this enum." });
      continue;
    }
    diagram.enums.push({ ...clone(item), id: createId() });
  }
  if (incoming.views.length > 0) {
    issues.push({
      level: "info",
      code: "import.views_skipped",
      path: "View",
      message: "Views are not imported yet; the diagram keeps its own.",
    });
  }

  return { applied: true, diagram, issues, plan };
}
