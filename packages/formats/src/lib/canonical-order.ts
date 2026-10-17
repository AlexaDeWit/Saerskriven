import { isRecord } from './records.js';

/**
 * A value rebuilt with its keys in the order its schema declares them, the
 * discriminator of a tagged variant first, which makes two writes of one
 * model byte-identical. An untagged union orders a value by the first member
 * whose required keys it holds, and an optional or nullable value is ordered
 * as the schema it wraps. The walk follows the schema's depth rather than the
 * value's, so a cycle a YAML alias built cannot drive it deeper. A key the
 * schema does not declare is dropped.
 */
export function canonicalOrder(schema: Schema, value: unknown): unknown {
  const { type, shape, element, options, discriminator, innerType } =
    schema.def;
  if (innerType !== undefined && (type === 'optional' || type === 'nullable')) {
    return canonicalOrder(innerType, value);
  }
  if (shape !== undefined) {
    return orderedFields(shape, value);
  }
  if (element !== undefined) {
    return Array.isArray(value)
      ? value.map((item: unknown) => canonicalOrder(element, item))
      : value;
  }
  if (options !== undefined) {
    return discriminator === undefined
      ? orderedMember(options, value)
      : orderedVariant(options, discriminator, value);
  }
  return value;
}

type SchemaDef = {
  readonly type: string;
  readonly shape?: Readonly<Record<string, Schema>>;
  readonly options?: readonly Schema[];
  readonly discriminator?: string;
  readonly element?: Schema;
  readonly innerType?: Schema;
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

function orderedMember(options: readonly Schema[], value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const shape = options
    .map((option) => option.def.shape)
    .find(
      (candidate) =>
        candidate !== undefined &&
        Object.entries(candidate).every(
          ([key, field]) =>
            field.def.type === 'optional' || Object.hasOwn(value, key),
        ),
    );
  return shape === undefined ? value : orderedFields(shape, value);
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
