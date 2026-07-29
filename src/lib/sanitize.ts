import { z } from "zod";

/**
 * Remove control characters (except tab, newline, carriage-return) and
 * trim whitespace. Use for any string coming from a user-facing input
 * before it is persisted or forwarded to a URL/API.
 */
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (input == null) return "";
  const raw = String(input);
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return cleaned.trim().slice(0, maxLength);
}

/** Sanitize but keep null when empty (useful for optional DB columns). */
export function sanitizeNullable(input: unknown, maxLength = 500): string | null {
  const s = sanitizeString(input, maxLength);
  return s.length === 0 ? null : s;
}

/** Escape a value used inside a Supabase `ilike` pattern. */
export function escapeIlike(input: string): string {
  return sanitizeString(input, 200).replace(/[%_\\]/g, (m) => `\\${m}`);
}

/** Safe encoding for query-string values sent to external URLs. */
export function safeUrlParam(input: unknown, maxLength = 200): string {
  return encodeURIComponent(sanitizeString(input, maxLength));
}

/* ---------- Reusable zod primitives ---------- */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "E-mail é obrigatório")
  .max(255, "E-mail muito longo")
  .email("E-mail inválido");

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .max(128, "Senha muito longa");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Nome é obrigatório")
  .max(120, "Nome muito longo")
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Nome contém caracteres inválidos");

export const shortTextSchema = z.string().trim().max(200, "Texto muito longo");
export const longTextSchema = z.string().trim().max(2000, "Texto muito longo");
