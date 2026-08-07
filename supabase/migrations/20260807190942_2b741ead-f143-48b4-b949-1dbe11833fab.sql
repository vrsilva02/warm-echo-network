-- Sincronizando schema da tabela ordens_servico com o código atual
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS aberto_por uuid REFERENCES auth.users(id);

-- Ajustando permissões para garantir que técnicos e gestores possam inserir
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;

-- Garantindo que as políticas de RLS permitam a inserção pelo usuário autenticado
DROP POLICY IF EXISTS "os_tecnico_insert" ON public.ordens_servico;
CREATE POLICY "os_tecnico_insert" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "os_write" ON public.ordens_servico;
CREATE POLICY "os_write" ON public.ordens_servico FOR ALL TO authenticated USING (public.is_gestor_or_admin(auth.uid())) WITH CHECK (public.is_gestor_or_admin(auth.uid()));
