create or replace view public.vw_ociosidade_financeira
  with (security_invoker = on)
as
select
  p.id as produto_id,
  p.nome_oficial,
  p.categoria,
  count(distinct a.id) filter (where a.data_fim is null) as licencas_ociosas,
  coalesce(sum(l.custo_unitario) filter (where a.data_fim is null), 0) as valor_ocioso
from public.produtos_catalogo p
left join public.licencas l on l.produto_id = p.id
left join public.alocacoes a on a.licenca_id = l.id
  and a.data_fim is null
  and a.data_inicio < (now() - interval '90 days')
group by p.id, p.nome_oficial, p.categoria;

grant select on public.vw_ociosidade_financeira to authenticated;
