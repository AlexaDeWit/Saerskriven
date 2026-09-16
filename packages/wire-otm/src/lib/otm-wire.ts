import { z } from 'zod';

const nullable = <Schema extends z.ZodType>(schema: Schema) =>
  z.union([schema, z.null()]);

const attributesSchema = nullable(z.record(z.string(), z.unknown())).optional();

const nullableTextListSchema = nullable(
  z.array(nullable(z.string())),
).optional();

const namedSchema = z.object({
  name: z.string(),
  id: z.string(),
  description: nullable(z.string()).optional(),
});

const sizeSchema = nullable(
  z.object({
    width: z.number(),
    height: z.number(),
  }),
);

const parentSchema = z
  .object({
    trustZone: z.string().optional(),
    component: z.string().optional(),
  })
  .refine(
    (value) =>
      (value.trustZone === undefined) !== (value.component === undefined),
    { message: 'A parent names exactly one trust zone or component' },
  );

const positionSchema = nullable(
  z.object({
    x: z.number(),
    y: z.number(),
  }),
);

const representationElementSchema = z.object({
  representation: z.string(),
  name: nullable(z.string()).optional(),
  id: z.string(),
  position: positionSchema.optional(),
  size: sizeSchema.optional(),
  file: nullable(z.string()).optional(),
  line: nullable(z.number()).optional(),
  codeSnippet: nullable(z.string()).optional(),
  attributes: attributesSchema,
});

const assetInstanceSchema = nullable(
  z.object({
    processed: nullableTextListSchema,
    stored: nullableTextListSchema,
  }),
);

const threatSchema = z.object({
  threat: z.string(),
  state: z.string(),
  mitigations: z
    .array(
      nullable(
        z.object({
          mitigation: nullable(z.string()),
          state: nullable(z.string()),
        }),
      ),
    )
    .optional(),
});

/** The complete OTM 0.2.0 wire document. */
export const otmWireSchema = z.object({
  otmVersion: z.literal('0.2.0'),
  project: namedSchema.extend({
    owner: nullable(z.string()).optional(),
    ownerContact: nullable(z.string()).optional(),
    tags: nullable(z.array(z.string())).optional(),
    attributes: attributesSchema,
  }),
  representations: nullable(
    z.array(
      namedSchema.extend({
        type: z.string(),
        size: sizeSchema.optional(),
        repository: nullable(
          z.object({
            url: nullable(z.string()),
          }),
        ).optional(),
        attributes: attributesSchema,
      }),
    ),
  ).optional(),
  assets: nullable(
    z.array(
      namedSchema.extend({
        risk: z.object({
          confidentiality: z.number(),
          integrity: z.number(),
          availability: z.number(),
          comment: nullable(z.string()).optional(),
        }),
        attributes: attributesSchema,
      }),
    ),
  ).optional(),
  trustZones: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().optional(),
        description: nullable(z.string()).optional(),
        risk: z.object({
          trustRating: z.number(),
        }),
        parent: parentSchema.optional(),
        representations: nullable(
          z.array(representationElementSchema),
        ).optional(),
        attributes: attributesSchema,
      }),
    )
    .optional(),
  components: nullable(
    z.array(
      namedSchema.extend({
        type: z.string(),
        parent: parentSchema,
        representations: nullable(
          z.array(representationElementSchema),
        ).optional(),
        assets: assetInstanceSchema.optional(),
        threats: nullable(z.array(threatSchema)).optional(),
        tags: nullableTextListSchema,
        attributes: attributesSchema,
      }),
    ),
  ).optional(),
  dataflows: z
    .array(
      namedSchema.extend({
        bidirectional: nullable(z.boolean()).optional(),
        source: z.string(),
        destination: z.string(),
        assets: nullableTextListSchema,
        threats: nullable(z.array(threatSchema)).optional(),
        tags: nullableTextListSchema,
        attributes: attributesSchema,
      }),
    )
    .optional(),
  threats: nullable(
    z.array(
      namedSchema.extend({
        categories: nullableTextListSchema,
        cwes: nullableTextListSchema,
        risk: z.object({
          likelihood: nullable(z.number()),
          likelihoodComment: nullable(z.string()).optional(),
          impact: z.number(),
          impactComment: z.string().optional(),
        }),
        tags: nullableTextListSchema,
        attributes: attributesSchema,
      }),
    ),
  ).optional(),
  mitigations: nullable(
    z.array(
      namedSchema.extend({
        riskReduction: z.number(),
        attributes: attributesSchema,
      }),
    ),
  ).optional(),
});

/** An OTM document before conversion to the core model. */
export type OtmDocument = z.infer<typeof otmWireSchema>;
