import { threatCategorySchema } from '@saerskriven/model';
import { enumeratedCategories } from '@saerskriven/model/fixtures';
import { equivalent } from './equivalence.js';
import {
  assumptionStatusesToModel,
  assumptionStatusesToWire,
  mitigationStatusesToModel,
  mitigationStatusesToWire,
  severitiesToModel,
  severitiesToWire,
  threatStatusesToModel,
  threatStatusesToWire,
  toModelCategory,
  toWireCategory,
} from './saerskriven-yaml-vocabulary.js';

type Table = Readonly<Record<string, string>>;

const vocabularies: readonly (readonly [string, Table, Table])[] = [
  ['severity', severitiesToModel, severitiesToWire],
  ['threat status', threatStatusesToModel, threatStatusesToWire],
  ['mitigation status', mitigationStatusesToModel, mitigationStatusesToWire],
  ['assumption status', assumptionStatusesToModel, assumptionStatusesToWire],
];

function strays([name, toModel, toWire]: readonly [
  string,
  Table,
  Table,
]): string[] {
  return [
    ...Object.entries(toModel).flatMap(([wire, model]) =>
      toWire[model] === wire ? [] : [`${name}: ${wire} to ${model} and back`],
    ),
    ...Object.entries(toWire).flatMap(([model, wire]) =>
      toModel[wire] === model ? [] : [`${name}: ${model} to ${wire} and back`],
    ),
  ];
}

const unrecovered = enumeratedCategories.flatMap(([methodology, categories]) =>
  categories
    .filter((category) => {
      const held = threatCategorySchema.parse({ methodology, category });
      return !equivalent(toModelCategory(toWireCategory(held)), held);
    })
    .map((category) => `${methodology}: ${category} to the file and back`),
);

describe('the tables between the format and the model', () => {
  it('carry every member of every vocabulary back to itself', () => {
    expect([...vocabularies.flatMap(strays), ...unrecovered]).toEqual([]);
  });
});
