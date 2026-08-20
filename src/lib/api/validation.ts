/**
 * Input validation schemas shared by the REST API and the storefront forms.
 * Every request body that reaches the database is parsed through Zod first.
 */
import { z } from "zod";

export const uuidSchema = z.string().uuid("A valid product identifier is required.");

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug.");

export const productQuerySchema = z.object({
  category: slugSchema.optional(),
  search: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating"]).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(12),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const addCartItemSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().min(1).max(99).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name.").max(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+()\-.\s0-9]*$/, "Phone numbers may only contain digits and + ( ) - .")
    .optional()
    .or(z.literal("")),
  marketingOptIn: z.boolean().default(false),
});

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "That password is too long.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password."),
});
