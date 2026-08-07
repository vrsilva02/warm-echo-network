-- Adicionar coluna alterado_por na tabela de histórico para rastreabilidade
ALTER TABLE public.ordens_servico_historico 
ADD COLUMN IF NOT EXISTS alterado_por uuid REFERENCES auth.users(id);

-- Tabela para notificações de sistema
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info',
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own notifications') THEN
        CREATE POLICY "Users can view their own notifications"
        ON public.user_notifications FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own notifications (read mark)') THEN
        CREATE POLICY "Users can update their own notifications (read mark)"
        ON public.user_notifications FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Função para disparar notificação em mudança de status de OS
CREATE OR REPLACE FUNCTION public.fn_notify_os_change()
RETURNS trigger AS $$
DECLARE
    v_user_id uuid;
    v_hostname text;
BEGIN
    -- Obter hostname do ativo
    SELECT hostname INTO v_hostname FROM public.ativos WHERE id = NEW.ativo_id;

    -- Notificar o admin e o gestor
    INSERT INTO public.user_notifications (user_id, title, message, type)
    SELECT user_id, 
           'OS #' || NEW.numero || ' - Mudança de Status',
           'O ativo ' || COALESCE(v_hostname, 'desconhecido') || ' mudou de ' || COALESCE(OLD.status, 'N/A') || ' para ' || NEW.status || ' em ' || to_char(now(), 'DD/MM/YYYY HH24:MI'),
           'os_alert'
    FROM public.user_roles 
    WHERE role IN ('admin', 'gestor_ti');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_os_status_notify ON public.ordens_servico;
CREATE TRIGGER tr_os_status_notify
AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.fn_notify_os_change();

-- Atualizar trigger de histórico para capturar o usuário que alterou
CREATE OR REPLACE FUNCTION public.tg_os_historico_update_fn()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ordens_servico_historico (
      ordem_servico_id, status_anterior, status_novo, alterado_por
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
