-- Adiciona coluna token e expira_em na tabela convites
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS token uuid DEFAULT gen_random_uuid();
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS expira_em timestamptz DEFAULT (now() + interval '72 hours');
ALTER TABLE public.convites ADD COLUMN IF NOT EXISTS aceito_em timestamptz;

-- Garante que 'aceito' existe no enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'status_convite' AND e.enumlabel = 'aceito') THEN
        ALTER TYPE public.status_convite ADD VALUE 'aceito';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        CREATE TYPE public.status_convite AS ENUM ('enfileirado', 'enviado', 'falhou', 'aceito');
END $$;

-- Logs de auditoria para convites
CREATE TABLE IF NOT EXISTS public.auditoria_convites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    convite_id uuid REFERENCES public.convites(id) ON DELETE CASCADE,
    evento text NOT NULL, -- 'criado', 'enviado', 'aceito', 'falhou', 'tentativa_invalida'
    detalhes jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.auditoria_convites TO authenticated;
GRANT ALL ON public.auditoria_convites TO service_role;
GRANT SELECT ON public.convites TO anon;
