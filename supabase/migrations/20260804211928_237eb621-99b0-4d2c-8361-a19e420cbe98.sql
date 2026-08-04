-- Migration: Create convites table to track invitation status
CREATE TYPE public.status_convite AS ENUM ('enfileirado', 'enviado', 'falhou');

CREATE TABLE public.convites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    nome TEXT,
    roles public.app_role[] NOT NULL,
    status public.status_convite NOT NULL DEFAULT 'enfileirado',
    erro TEXT,
    enviado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

-- Enable RLS
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage convites"
ON public.convites
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
