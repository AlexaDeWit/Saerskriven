import {
  ciaCategorySchema,
  ciaDieCategorySchema,
  linddunCategorySchema,
  plot4aiCategorySchema,
  strideCategorySchema,
  threatCategorySchema,
  type ThreatCategory,
} from '@saerskriven/model';

import { EnumField } from './enum-field.js';

const enumerated: readonly {
  readonly methodology: string;
  readonly categories: readonly string[];
}[] = [
  {
    methodology: strideCategorySchema.shape.methodology.value,
    categories: strideCategorySchema.shape.category.options,
  },
  {
    methodology: linddunCategorySchema.shape.methodology.value,
    categories: linddunCategorySchema.shape.category.options,
  },
  {
    methodology: ciaCategorySchema.shape.methodology.value,
    categories: ciaCategorySchema.shape.category.options,
  },
  {
    methodology: ciaDieCategorySchema.shape.methodology.value,
    categories: ciaDieCategorySchema.shape.category.options,
  },
  {
    methodology: plot4aiCategorySchema.shape.methodology.value,
    categories: plot4aiCategorySchema.shape.category.options,
  },
];

function methodologyOf(key: string): string {
  return key.split(' ')[0];
}

function categoryFromKey(key: string): ThreatCategory | undefined {
  const [methodology, ...rest] = key.split(' ');
  const parsed = threatCategorySchema.safeParse({
    methodology,
    category: rest.join(' '),
  });
  return parsed.success ? parsed.data : undefined;
}

/**
 * A category as one listbox string: the methodology, a space and the
 * category. A custom category's key starts with `custom`, so it cannot
 * collide with an enumerated pair.
 */
export function categoryKey(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? `custom ${category.methodologyName} ${category.category}`
    : `${category.methodology} ${category.category}`;
}

/** The key of every enumerated methodology and category pair, in the union's order. */
export const enumeratedCategoryKeys: readonly string[] = enumerated.flatMap(
  ({ methodology, categories }) =>
    categories.map((category) => `${methodology} ${category}`),
);

/**
 * The listbox's value handler, bound to one `onCommit`. A key the category
 * schema does not parse, a custom category's among them, commits nothing.
 */
export function categoryCommitter(
  onCommit: (category: ThreatCategory) => void,
): (chosen: string) => void {
  return (chosen) => {
    const category = categoryFromKey(chosen);
    if (category !== undefined) {
      onCommit(category);
    }
  };
}

type CategoryFieldProps = {
  readonly value: ThreatCategory;
  readonly onCommit: (category: ThreatCategory) => void;
};

/**
 * A threat's category as one listbox of methodology and category pairs,
 * grouped by methodology. A custom category is offered as an option of its
 * own ahead of the enumerated pairs.
 */
export function CategoryField({ value, onCommit }: CategoryFieldProps) {
  const key = categoryKey(value);
  const options = enumeratedCategoryKeys.includes(key)
    ? enumeratedCategoryKeys
    : [key, ...enumeratedCategoryKeys];

  return (
    <EnumField
      groupOf={methodologyOf}
      label="Category"
      onCommit={categoryCommitter(onCommit)}
      options={options}
      value={key}
    />
  );
}
