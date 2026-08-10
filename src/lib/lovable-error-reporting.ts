// This file is disabled to prevent reporting to Lovable.
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("Application Error Context:", context);
  console.error(error);
}
