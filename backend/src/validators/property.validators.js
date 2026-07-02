const { z } = require('zod');

const createPropertySchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(5000),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(5).max(300),
    bedrooms: z.coerce.number().int().min(0).max(20),
    bathrooms: z.coerce.number().int().min(0).max(20),
    sizeSqft: z.coerce.number().int().min(0),
    amenities: z.array(z.string().trim().max(100)).max(30).default([]),
    rentPerMonth: z.coerce.number().min(0),
  })
  .strict();

// Only a subset of fields is updatable. ownerId and status are server-
// controlled and are never accepted from the update body.
const updatePropertySchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    address: z.string().trim().min(5).max(300).optional(),
    bedrooms: z.coerce.number().int().min(0).max(20).optional(),
    bathrooms: z.coerce.number().int().min(0).max(20).optional(),
    sizeSqft: z.coerce.number().int().min(0).optional(),
    amenities: z.array(z.string().trim().max(100)).max(30).optional(),
    rentPerMonth: z.coerce.number().min(0).optional(),
  })
  .strict();

const propertySearchSchema = z.object({
  city: z.string().trim().max(100).optional(),
  maxRent: z.coerce.number().min(0).optional(),
  minRent: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  query: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const importPhotoSchema = z
  .object({
    imageUrl: z.string().url().max(2048),
  })
  .strict();

module.exports = {
  createPropertySchema,
  updatePropertySchema,
  propertySearchSchema,
  importPhotoSchema,
};
