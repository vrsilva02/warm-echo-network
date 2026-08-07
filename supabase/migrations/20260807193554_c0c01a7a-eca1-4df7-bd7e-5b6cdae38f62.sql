-- Tabela para armazenar o histórico de mudanças de status das OS
CREATE TABLE public.ordens_servico_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE CASCADE NOT NULL,
    status_anterior public.os_status,
    status_novo public.os_status NOT NULL,
    alterado_por uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Permissões para ordens_servico_historico
GRANT SELECT ON public.ordens_servico_historico TO authenticated;
GRANT ALL ON public.ordens_servico_historico TO service_role;

-- RLS
ALTER TABLE public.ordens_servico_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_historico_read" ON public.ordens_servico_historico
    FOR SELECT TO authenticated USING (true);

-- Trigger para registrar a criação da OS no histórico
CREATE OR REPLACE FUNCTION fn_os_historico_insert()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.ordens_servico_historico (ordem_servico_id, status_novo, alterado_por, created_at)
    VALUES (NEW.id, NEW.status, NEW.aberto_por, NEW.data_abertura);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_os_historico_insert
    AFTER INSERT ON public.ordens_servico
    FOR EACH ROW EXECUTE FUNCTION fn_os_historico_insert();

-- Trigger para registrar mudanças de status no histórico
CREATE OR REPLACE FUNCTION fn_os_historico_update()
RETURNS trigger AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.ordens_servico_historico (ordem_servico_id, status_anterior, status_novo, alterado_por)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_os_historico_update
    AFTER UPDATE ON public.ordens_servico
    FOR EACH ROW EXECUTE FUNCTION fn_os_historico_update();

-- Popular histórico inicial para OS existentes que ainda não tenham registros
INSERT INTO public.ordens_servico_historico (ordem_servico_id, status_novo, alterado_por, created_at)
SELECT id, status, aberto_por, data_abertura
FROM public.ordens_servico
WHERE id NOT IN (SELECT ordem_servico_id FROM public.ordens_servico_historico);
