import { isRecord } from './records.js';

type SchemaDef = {
  readonly type: string;
  readonly shape?: Readonly<Record<string, Schema>>;
  readonly options?: readonly Schema[];
  readonly discriminator?: string;
  readonly entries?: Readonly<Record<string, string>>;
  readonly values?: readonly unknown[];
  readonly element?: Schema;
  readonly innerType?: Schema;
  readonly valueType?: Schema;
};

type Schema = {
  readonly def: SchemaDef;
  readonly safeParse: (value: unknown) => { readonly success: boolean };
};

type Construct = { readonly name: string; readonly key: string };

const leafTypes: ReadonlySet<string> = new Set([
  'string',
  'number',
  'boolean',
  'literal',
  'null',
  'unknown',
  'enum',
]);

const containerTypes: ReadonlySet<string> = new Set([
  'optional',
  'nullable',
  'object',
  'array',
  'record',
  'union',
]);

type Keys = {
  readonly field: (field: string, fieldSchema: Schema) => string;
  readonly value: (schema: Schema, value: string) => string;
  readonly variant: (union: Schema, variant: Schema) => string;
};

/**
 * Every construct a wire schema declares that none of the documents uses: a
 * field no document sets, an enum value no document holds, and a union
 * variant no document takes. A construct is told apart by the schema
 * instance that declares it, not by its path: a field schema counts once
 * under its name wherever it is used, whether shared through `.extend()` or
 * through a constant, and an enum counts once however many fields share it.
 * A new field built from a shared schema already used under the same name
 * elsewhere is therefore not flagged. A nullable union's `null` is not a
 * variant, and a record's keys are free. Each construct is named by the first
 * path the schema declares it at. A schema type the walk does not know
 * throws, so a wrapper such as `.readonly()` cannot hide what it wraps. The
 * result is empty where the documents together use the whole schema.
 */
export function unusedConstructs(
  schema: Schema,
  documents: readonly unknown[],
): readonly string[] {
  const keys = keysByIdentity();
  const declared = new Map<string, string>();
  const used = new Set<string>();
  declare(schema, '', keys, declared, new Set());
  for (const document of documents) {
    use(schema, document, keys, used);
  }
  return [...declared]
    .filter(([key]) => !used.has(key))
    .map(([, name]) => name);
}

function keysByIdentity(): Keys {
  const identities = new Map<Schema, number>();
  const identity = (schema: Schema): number => {
    const known = identities.get(schema) ?? identities.size;
    identities.set(schema, known);
    return known;
  };
  return {
    field: (field, fieldSchema) => `field ${field} ${identity(fieldSchema)}`,
    value: (schema, value) => `value ${identity(schema)} ${value}`,
    variant: (union, variant) =>
      `variant ${identity(union)} ${identity(variant)}`,
  };
}

function declare(
  schema: Schema,
  path: string,
  keys: Keys,
  into: Map<string, string>,
  seen: Set<Schema>,
): void {
  if (seen.has(schema)) {
    return;
  }
  seen.add(schema);
  for (const { name, key } of ownConstructs(schema, path, keys)) {
    if (!into.has(key)) {
      into.set(key, name);
    }
  }
  for (const [child, childPath] of children(schema, path)) {
    declare(child, childPath, keys, into, seen);
  }
}

function ownConstructs(
  schema: Schema,
  path: string,
  keys: Keys,
): readonly Construct[] {
  const def = schema.def;
  if (def.type === 'object' && def.shape) {
    return Object.entries(def.shape).map(([field, fieldSchema]) => ({
      name: `${path}.${field}`,
      key: keys.field(field, fieldSchema),
    }));
  }
  if (def.type === 'enum' && def.entries) {
    return Object.values(def.entries).map((value) => ({
      name: `${path}=${value}`,
      key: keys.value(schema, value),
    }));
  }
  if (def.type === 'union') {
    const variants = variantsOf(schema);
    return variants.length === 1
      ? []
      : variants.map((variant) => ({
          name: `${path}|${labelOf(schema, variant)}`,
          key: keys.variant(schema, variant),
        }));
  }
  return [];
}

function children(
  schema: Schema,
  path: string,
): readonly (readonly [Schema, string])[] {
  const def = walked(schema, path);
  if ((def.type === 'optional' || def.type === 'nullable') && def.innerType) {
    return [[def.innerType, path]];
  }
  if (def.type === 'object' && def.shape) {
    return Object.entries(def.shape).map(([field, fieldSchema]) => [
      fieldSchema,
      `${path}.${field}`,
    ]);
  }
  if (def.type === 'array' && def.element) {
    return [[def.element, `${path}[]`]];
  }
  if (def.type === 'record' && def.valueType) {
    return [[def.valueType, `${path}{}`]];
  }
  if (def.type === 'union') {
    const variants = variantsOf(schema);
    return variants.map((variant) => [
      variant,
      variants.length === 1 ? path : `${path}|${labelOf(schema, variant)}`,
    ]);
  }
  return [];
}

function use(
  schema: Schema,
  value: unknown,
  keys: Keys,
  into: Set<string>,
): void {
  const def = walked(schema, 'a document');
  if (value === undefined || value === null) {
    return;
  }
  if ((def.type === 'optional' || def.type === 'nullable') && def.innerType) {
    use(def.innerType, value, keys, into);
  } else if (def.type === 'object' && def.shape && isRecord(value)) {
    for (const [field, fieldSchema] of Object.entries(def.shape)) {
      if (value[field] !== undefined) {
        into.add(keys.field(field, fieldSchema));
        use(fieldSchema, value[field], keys, into);
      }
    }
  } else if (def.type === 'array' && def.element && Array.isArray(value)) {
    for (const entry of value) {
      use(def.element, entry, keys, into);
    }
  } else if (def.type === 'record' && def.valueType && isRecord(value)) {
    for (const entry of Object.values(value)) {
      use(def.valueType, entry, keys, into);
    }
  } else if (def.type === 'enum' && typeof value === 'string') {
    into.add(keys.value(schema, value));
  } else if (def.type === 'union') {
    const taken = variantsOf(schema).find(
      (variant) => variant.safeParse(value).success,
    );
    if (taken !== undefined) {
      into.add(keys.variant(schema, taken));
      use(taken, value, keys, into);
    }
  }
}

function walked(schema: Schema, path: string): SchemaDef {
  const def = schema.def;
  const known =
    containerTypes.has(def.type) ||
    (leafTypes.has(def.type) &&
      (def.type !== 'literal' || def.values?.length === 1));
  if (!known) {
    throw new Error(
      `The coverage walk does not know the ${def.type} schema at ${path === '' ? 'the root' : path}.`,
    );
  }
  return def;
}

function variantsOf(schema: Schema): readonly Schema[] {
  return (schema.def.options ?? []).filter(
    (option) => option.def.type !== 'null',
  );
}

function labelOf(union: Schema, variant: Schema): string {
  const discriminator = union.def.discriminator;
  const tag =
    discriminator === undefined
      ? undefined
      : variant.def.shape?.[discriminator]?.def.values?.[0];
  return typeof tag === 'string'
    ? `${discriminator}=${tag}`
    : `${variant.def.type}#${variantsOf(union).indexOf(variant)}`;
}
