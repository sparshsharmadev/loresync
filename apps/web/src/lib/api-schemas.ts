import { z } from "zod";

export const createAnalysisSchema = z.object({
  title: z.string().trim().min(1).max(120),
  platform: z.enum(["whatsapp", "discord"]),
  consentAccepted: z.literal(true),
}).strict();

const importedMessageSchema = z.object({
  timestamp: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  sender: z.string().trim().min(1).max(200),
  content: z.string().max(100_000),
  hasAttachment: z.boolean(),
  rawId: z.string().max(200).nullable().optional(),
}).strict();

export const appendMessagesSchema = z.object({
  batchId: z.uuid(),
  messages: z.array(importedMessageSchema).min(1).max(10_000),
}).strict();

const photoSchema = z.string().max(500_000).refine((value) => value === "" || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value));
const usernameSchema = z.string().max(24).refine((value) => value === "" || /^[a-z0-9_]{3,24}$/.test(value));

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  display_name: z.string().max(48).optional(),
  pronouns: z.string().max(32).optional(),
  about: z.string().max(140).optional(),
  photo: photoSchema.optional(),
  avatar_style: z.enum(["initials", "orbit", "monogram"]).optional(),
  avatar_tone: z.enum(["paper", "night", "red", "moss"]).optional(),
  accent: z.enum(["signal", "blue", "moss", "amber", "plum"]).optional(),
  density: z.enum(["roomy", "balanced", "compact"]).optional(),
  type_scale: z.enum(["small", "standard", "large"]).optional(),
  reduced_motion: z.boolean().optional(),
  default_storage: z.enum(["local", "cloud"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(1_024),
  confirmation: z.literal("DELETE"),
}).strict();

export const uuidSchema = z.uuid();
const cursorTimestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
export const analysisCursorSchema = z.object({ createdAt: cursorTimestampSchema, id: z.uuid() }).strict();
export const messageCursorSchema = z.object({ sentAt: cursorTimestampSchema, id: z.string().regex(/^\d+$/) }).strict();

export const archivePageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(256).optional(),
});

export const messagePageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().max(256).optional(),
  q: z.string().trim().max(200).refine((value) => value.length === 0 || value.length >= 3).optional(),
  sender: z.string().trim().max(200).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
}).strict();
