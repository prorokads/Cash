import { z } from "zod";
import { services, addons, functions, urgencies } from "./calculator.mjs";
const rateKeys = [
  ...services.flatMap((s) => [s.id, `${s.id}-extra`]),
  ...addons.map((a) => a.id),
  ...functions.map((f) => f.id),
];
export const ratesSchema = z.partialRecord(
  z.enum(rateKeys),
  z.number().int().min(0).max(10000000),
);
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  client: z.string().max(120),
  service: z.enum(services.map((s) => s.id)),
  quantity: z.number().int().min(1).max(100),
  addons: z
    .array(z.enum(addons.map((a) => a.id)))
    .max(addons.length)
    .transform((a) => [...new Set(a)]),
  functions: z
    .array(z.enum(functions.map((f) => f.id)))
    .max(functions.length)
    .transform((a) => [...new Set(a)]),
  urgency: z.enum(urgencies.map((u) => u.id)),
  discount: z.number().int().min(0).max(50),
  notes: z.string().max(4000),
  rates: ratesSchema,
});
