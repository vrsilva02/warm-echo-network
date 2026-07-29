import type { StatusTone } from "@/components/status-pill";

/** Mapeia a criticidade de um serviço de negócio para o tom visual do StatusPill. */
export function criticidadeTone(c: string | null | undefined): StatusTone {
  if (c === "critica") return "critical";
  if (c === "alta") return "warn";
  if (c === "media") return "info";
  return "neutral";
}
