-- Adiciona novos valores ao enum de perfis
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'padrao';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visitante';