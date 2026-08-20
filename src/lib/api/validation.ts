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

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const addressSchema = z.object({
  label: z.string().trim().min(1, "Add a short label.").max(40),
  recipientName: z.string().trim().min(1, "Who should receive this?").max(120),
  line1: z.string().trim().min(1, "Street address is required.").max(160),
  line2: optionalText(160),
  city: z.string().trim().min(1, "City is required.").max(80),
  state: optionalText(80),
  postalCode: z
    .string()
    .trim()
    .min(2, "Postal code is required.")
    .max(16)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "Enter a valid postal code."),
  country: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code.")
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.")
    .transform((value) => value.toUpperCase()),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+()\-.\s0-9]*$/, "Phone numbers may only contain digits and + ( ) - .")
    .optional()
    .or(z.literal("")),
  isDefault: z.boolean().default(false),
});

/**
 * Checkout only accepts an address id and a mock payment method. Prices,
 * totals and product names are never accepted from the client.
 */
export const checkoutSchema = z.object({
  addressId: z.string().uuid("Select a delivery address."),
  paymentMethod: z.enum(["test_success", "test_decline"]),
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

/**
 * Body schema for the BFLA training lab's privileged status-transition
 * function. Only the target status is accepted; identity and role are always
 * derived server-side from the verified session.
 */
export const labStatusSchema = z.object({
  status: z.enum(["paid", "processing", "shipped", "delivered", "cancelled"]),
});

/**
 * Body schemas for the Broken Authentication training lab (API2:2023).
 * The synthetic portal accepts a username + password, or a numeric recovery
 * code. Input is validated identically on the vulnerable and secure variants —
 * the intentional weakness is in the authentication logic, not in parsing.
 */
export const labCredentialsSchema = z.object({
  username: z.string().trim().min(1, "Enter a username.").max(64),
  password: z.string().min(1, "Enter a password.").max(200),
});

export const labOtpSchema = z.object({
  username: z.string().trim().min(1, "Enter a username.").max(64),
  code: z.string().trim().regex(/^\d{4,8}$/, "Codes are 4-8 digits."),
});

/**
 * Body schemas for the Unrestricted Resource Consumption lab (API4:2023).
 * Both variants parse input identically — the intentional weakness is the
 * absence of consumption CONTROLS (ceilings, rate limits, budgets), not the
 * absence of parsing. Bounds here only keep the lab itself from being abused.
 */
export const labExportSchema = z.object({
  limit: z.number().int().min(1).max(1_000_000).default(25),
  workFactor: z.number().int().min(1).max(1_000).default(1),
});

export const labNotifySchema = z.object({
  count: z.number().int().min(1).max(1_000).default(1),
});

/** Body schema for the sensitive business flow lab (API6:2023). */
export const labBuySchema = z.object({
  quantity: z.number().int().min(1).max(1_000).default(1),
});

/** Body schema for the SSRF lab (API7:2023). */
export const labImportSchema = z.object({
  url: z.string().trim().min(1, "Enter a URL.").max(2048),
});

/** Body schema for the security misconfiguration lab (API8:2023). */
export const labProbeSchema = z.object({
  probe: z.enum(["diagnostics", "error", "headers"]).default("diagnostics"),
});
