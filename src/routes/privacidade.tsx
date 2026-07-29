import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft, Mail } from "lucide-react";
import { ReopenConsentButton } from "@/components/cookie-consent";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — GestoraIT" },
      {
        name: "description",
        content:
          "Como o GestoraIT trata dados pessoais em conformidade com a LGPD (Lei 13.709/2018).",
      },
      { property: "og:title", content: "Política de Privacidade — GestoraIT" },
      {
        property: "og:description",
        content: "Tratamento de dados pessoais em conformidade com a LGPD.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary p-1.5 text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">GestoraIT</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Política de Privacidade
              </div>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-sm text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}. Este
            documento descreve como o GestoraIT trata dados pessoais em conformidade
            com a <strong className="text-foreground">Lei Geral de Proteção de
            Dados (Lei 13.709/2018 — LGPD)</strong>.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-8 shadow-sm">
          <Section title="1. Sobre o sistema">
            <p>
              O GestoraIT é uma plataforma corporativa de gestão de ativos de TI,
              licenças de software, contratos e ordens de serviço. É operado pela
              organização contratante (Controlador dos dados) e mantido pela{" "}
              <strong className="text-foreground">MTR2.TECH</strong> na condição de
              Operador, conforme art. 5º, VI e VII da LGPD.
            </p>
          </Section>

          <Section title="2. Dados tratados">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Identificação:</strong> nome,
                e-mail corporativo, matrícula e setor.
              </li>
              <li>
                <strong className="text-foreground">Autenticação:</strong> senha
                (armazenada com hash), tokens de sessão, IP e data/hora de acesso.
              </li>
              <li>
                <strong className="text-foreground">Operacionais:</strong> ativos
                atribuídos, licenças alocadas, ordens de serviço abertas, anexos.
              </li>
              <li>
                <strong className="text-foreground">Auditoria:</strong> registro de
                ações (INSERT/UPDATE/DELETE) para fins de trilha e compliance.
              </li>
            </ul>
          </Section>

          <Section title="3. Finalidades e base legal">
            <p>
              Os dados são tratados para (i) autenticação e controle de acesso,
              (ii) gestão de inventário e conformidade de licenciamento, (iii)
              cumprimento de obrigações contratuais e regulatórias e (iv) segurança
              da informação. As bases legais aplicáveis são:{" "}
              <em>execução de contrato</em> (art. 7º, V), <em>obrigação legal</em>{" "}
              (art. 7º, II) e <em>legítimo interesse</em> (art. 7º, IX).
            </p>
          </Section>

          <Section title="4. Cookies e tecnologias similares">
            <p>
              Utilizamos apenas cookies estritamente necessários para a sessão
              autenticada. Cookies analíticos, quando existirem, dependem do seu
              consentimento explícito e podem ser revogados a qualquer momento pelo
              botão abaixo.
            </p>
            <div className="pt-2">
              <ReopenConsentButton />
            </div>
          </Section>

          <Section title="5. Compartilhamento">
            <p>
              Não vendemos dados pessoais. Compartilhamos informações apenas com
              provedores essenciais à operação (hospedagem em nuvem, banco de dados
              gerenciado, envio transacional de e-mail) sob acordo de tratamento
              equivalente ao exigido pela LGPD.
            </p>
          </Section>

          <Section title="6. Retenção">
            <p>
              Dados de acesso e auditoria são retidos por até{" "}
              <strong className="text-foreground">5 anos</strong> para fins de
              rastreabilidade e obrigações fiscais/regulatórias. Após o
              encerramento do vínculo, dados de identificação podem ser
              anonimizados ou eliminados mediante solicitação do titular ou do
              Controlador.
            </p>
          </Section>

          <Section title="7. Direitos do titular (art. 18 da LGPD)">
            <ul className="list-disc space-y-1 pl-5">
              <li>Confirmação da existência de tratamento;</li>
              <li>Acesso aos dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade;</li>
              <li>Informação sobre compartilhamentos;</li>
              <li>Revogação do consentimento.</li>
            </ul>
          </Section>

          <Section title="8. Segurança">
            <p>
              Aplicamos boas práticas de segurança: TLS em trânsito, criptografia
              em repouso, políticas de Row-Level Security no banco, controle de
              acesso por perfis (Admin, Gestão, Técnico, Padrão, Visitante),
              auditoria de alterações e expiração automática de sessão.
            </p>
          </Section>

          <Section title="9. Encarregado (DPO) e contato">
            <p>
              Solicitações relativas aos direitos previstos na LGPD podem ser
              enviadas para o Encarregado de Proteção de Dados através do canal
              indicado pela sua organização, ou ao Operador em:
            </p>
            <p className="inline-flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-foreground">
              <Mail className="h-3.5 w-3.5" /> dpo@mtr2.tech
            </p>
          </Section>
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          GestoraIT · Powered by MTR2.TECH
        </p>
      </main>
    </div>
  );
}
