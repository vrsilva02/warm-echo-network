import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { agregarMetricas, type ModuloResumo } from "@/lib/desempenho";

export type ResumoSemanal = {
  modulos: ModuloResumo[];
  totalAmostras: number;
  analise: string | null;
  erro: string | null;
};

/** Agrega os tempos de carregamento dos últimos 7 dias e pede à IA as causas prováveis. */
export const resumoDesempenhoSemanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoSemanal> => {
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data, error } = await (context.supabase as any)
      .from("metricas_carregamento")
      .select("modulo, duracao_ms")
      .gte("created_at", desde)
      .limit(20000);
    if (error) throw new Error("Sem permissão para ver as métricas de desempenho.");
    const modulos = agregarMetricas(data ?? []);
    const totalAmostras = (data ?? []).length;
    if (modulos.length === 0) return { modulos, totalAmostras, analise: null, erro: null };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { modulos, totalAmostras, analise: null, erro: "Análise por IA indisponível no momento." };

    const [{ createOpenAI }, { streamText }, { createLovableAiGatewayRunIdFetch }] = await Promise.all([
      import("@ai-sdk/openai"),
      import("ai"),
      import("@/lib/ai/run-id.server"),
    ]);
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const tabela = modulos
      .slice(0, 10)
      .map((m) => `${m.modulo}: média ${m.mediaMs}ms, p95 ${m.p95Ms}ms, máx ${m.maxMs}ms, ${m.amostras} acessos`)
      .join("\n");
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system:
          "Você é um especialista em desempenho de sistemas web de gestão de ativos de TI (React + banco Postgres com regras de acesso por linha). Responda em português do Brasil, de forma curta e sem jargão: para os 3 módulos mais lentos, dê uma frase com a causa provável e uma ação sugerida. Use lista com marcadores. No máximo 120 palavras.",
        prompt: `Tempos de carregamento por módulo nos últimos 7 dias (o sistema tem cerca de 11 mil ativos e carrega listas completas em páginas de 1000):\n${tabela}`,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const analise = (await result.text).trim();
      return { modulos, totalAmostras, analise: analise || null, erro: analise ? null : "A IA não retornou análise." };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      const erro =
        status === 402
          ? "Créditos de IA esgotados. Adicione créditos para gerar a análise."
          : status === 429
            ? "Muitas solicitações à IA. Tente novamente em alguns minutos."
            : "Não foi possível gerar a análise por IA agora.";
      return { modulos, totalAmostras, analise: null, erro };
    }
  });
