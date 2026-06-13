// Shared Zod building blocks for the catalog validators: enums, geo, address,
// money, and a comma-separated → array coercion used by the public query params.
import { z } from 'zod';
import { CUISINE_TYPE } from '../../../../domain/catalog/enums/cuisine-type.enum';
import { DIETARY_TAG } from '../../../../domain/catalog/enums/dietary-tag.enum';
import { CATALOG_VISIBILITY } from '../../../../domain/catalog/enums/catalog-visibility.enum';
import { VARIANT_SELECTION_TYPE } from '../../../../domain/catalog/enums/variant-selection-type.enum';
import { WEEKDAY } from '../../../../domain/catalog/enums/weekday.enum';

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [string, ...string[]];

export const cuisineEnum = z.enum(enumValues(CUISINE_TYPE));
export const dietaryEnum = z.enum(enumValues(DIETARY_TAG));
export const visibilityEnum = z.enum(enumValues(CATALOG_VISIBILITY));
export const selectionTypeEnum = z.enum(enumValues(VARIANT_SELECTION_TYPE));
export const weekdayEnum = z.enum(enumValues(WEEKDAY));

export const uuid = z.string().uuid('Invalid id format');

export const latLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const moneyInput = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
});

export const addressInput = z.object({
  label: z.string().min(1).max(60).optional(),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(80),
  state: z.string().min(1).max(80),
  pinCode: z.string().min(3).max(12),
  coordinates: latLng,
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayInterval = z.object({
  open: z.string().regex(HHMM, 'open must be HH:mm'),
  close: z.string().regex(HHMM, 'close must be HH:mm'),
});

/** Partial weekly schedule — any subset of weekdays, each an array of intervals. */
export const weeklySchedule = z.record(weekdayEnum, z.array(dayInterval));

/** Public query params arrive as strings; turn "a,b,c" into ["a","b","c"]. */
export const csvOf = (item: z.ZodTypeAny) =>
  z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(item) as unknown as z.ZodType<string[], string[]>)
    .optional();

export const boolFromString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const cursorLimit = {
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
};
