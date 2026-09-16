import { isRecord } from './records.js';

/**
 * A value rebuilt with its keys in the order its schema declares them, the
 * discriminator of a tagged variant first, which makes two writes of one
 * model byte-identical. The walk follows the schema's depth rather than the
 * value's, so a cycle a YAML alias built cannot drive it deeper. A key the
 * schema does not declare is dropped.
 */
export function canonicalOrder(schema: Schema, value: unknown): unknown {
  const { shape, element, options, discriminator } = schema.def;
  if (shape !== undefined) {
    return orderedFields(shape, value);
  }
  if (element !== undefined) {
    return Array.isArray(value)
      ? value.map((item: unknown) => canonicalOrder(element, item))
      : value;
  }
  if (options !== undefined && discriminator !== undefined) {
    return orderedVariant(options, discriminator, value);
  }
  return value;
}

type SchemaDef = {
  readonly type: string;
  readonly shape?: Readonly<Record<string, Schema>>;
  readonly options?: readonly Schema[];
  readonly discriminator?: string;
  readonly element?: Schema;
  readonly values?: readonly unknown[];
};

type Schema = { readonly def: SchemaDef };

type Shape = Readonly<Record<string, Schema>>;

function orderedVariant(
  options: readonly Schema[],
  discriminator: string,
  value: unknown,
): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const shape = variantShape(options, discriminator, value[discriminator]);
  return shape === undefined
    ? value
    : orderedFields(shape, value, discriminator);
}

function variantShape(
  options: readonly Schema[],
  discriminator: string,
  tag: unknown,
): Shape | undefined {
  for (const option of options) {
    const shape = option.def.shape;
    if (shape?.[discriminator]?.def.values?.includes(tag) === true) {
      return shape;
    }
  }
  return undefined;
}

function orderedFields(
  shape: Shape,
  value: unknown,
  leading?: string,
): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const ordered: Record<string, unknown> = {};
  for (const [key, field] of leadingFirst(shape, leading)) {
    if (Object.hasOwn(value, key)) {
      ordered[key] = canonicalOrder(field, value[key]);
    }
  }
  return ordered;
}

function leadingFirst(
  shape: Shape,
  leading: string | undefined,
): [string, Schema][] {
  const fields = Object.entries(shape);
  return leading === undefined
    ? fields
    : [
        ...fields.filter(([key]) => key === leading),
        ...fields.filter(([key]) => key !== leading),
      ];
}
