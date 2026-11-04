-- Tramitação CS · banco, regras de acesso, histórico e sincronização com a planilha.
-- Rode tudo de uma vez no Supabase: SQL Editor → New query → cole este arquivo → Run.
-- Pode rodar de novo sem problema (só cria/atualiza o que faltar).

-- ---------- perfis (quem é quem) ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  papel text not null default 'leitor' check (papel in ('leitor', 'editor', 'admin')),
  criado_em timestamptz not null default now()
);

create or replace function public.novo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();
insert into public.perfis (id, nome, email)
select id, split_part(email, '@', 1), email from auth.users
on conflict (id) do nothing;

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;
create or replace function public.pode_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('editor', 'admin'), false)
$$;

-- ---------- status permitidos nas etapas ----------
create or replace function public.status_valido(v text)
returns boolean language sql immutable as $$
  select v is null or v in (
    'Pendiente', 'Solicitado', 'Enviado', 'Executando', 'OK', 'Já possui', 'Não precisa', 'Renovar', 'Revisar',
    'Traducir', 'Traduciendo', 'Transcripción', 'Actualizar', 'Actualizando', 'Actualizar y traducir',
    'Liberar', 'Agendar', 'Agendado', 'Pagar', 'Firmar', 'Corrigir', 'En análisis', 'Indeferido', 'Arquivado',
    'RNM oficial', 'RNM provisório', 'Registro'
  )
$$;

-- ---------- trâmites: uma linha por aluno em cada turma ----------
create table if not exists public.tramites (
  id uuid primary key default gen_random_uuid(),
  linha_origem int,
  aluno_chave text not null default '',
  nome text not null check (length(nome) between 1 and 200),
  grupo text,
  lote int,
  pais text,
  telefone text,
  responsavel text,
  status_geral text check (status_geral is null or status_geral in
    ('Lead', 'Promessa', 'Pendiente', 'Executando', 'Stand by', 'Concluído', 'Já possui', 'Não precisa', 'Sem interesse')),
  agendar text check (agendar is null or agendar in ('Agendar', 'Agendado', 'Comunicado', 'Renovar', 'Pendiente', 'OK', 'Não')),
  visa text check (visa is null or visa in ('Pendente', 'OK')),
  prox_modulo date,
  modulo_finalizado boolean not null default false,
  data_renovacao date,
  renovacao_status text,
  paquete_completo boolean,
  paquete_grupo boolean,
  produto text,
  preco numeric(10, 2),
  data_venda date,
  pagamento text check (pagamento is null or pagamento in
    ('Pago', 'Pendiente', 'Compromisso', 'Compromisso atrasado', 'Promessa', 'Link enviado')),
  -- dados
  cpf text,
  nascimento date,
  rnm_numero_protocolo text,
  rnm_numero text,
  -- CPF
  cpf_condicion_fiscal text check (public.status_valido(cpf_condicion_fiscal)),
  cpf_pasaporte_rostro text check (public.status_valido(cpf_pasaporte_rostro)),
  cpf_pasaporte text check (public.status_valido(cpf_pasaporte)),
  cpf_solicitado_sitio text check (public.status_valido(cpf_solicitado_sitio)),
  cpf_correo_rfb text check (public.status_valido(cpf_correo_rfb)),
  cpf_protocolo text check (public.status_valido(cpf_protocolo)),
  -- RNM
  rnm_pasaporte text check (public.status_valido(rnm_pasaporte)),
  rnm_cert_nacimiento text check (public.status_valido(rnm_cert_nacimiento)),
  rnm_antecedentes text check (public.status_valido(rnm_antecedentes)),
  rnm_extracto_bancario text check (public.status_valido(rnm_extracto_bancario)),
  rnm_declaracion text check (public.status_valido(rnm_declaracion)),
  rnm_protocolo text check (public.status_valido(rnm_protocolo)),
  rnm_nacimiento text check (public.status_valido(rnm_nacimiento)),
  rnm_grus_pagos text check (public.status_valido(rnm_grus_pagos)),
  rnm_dec_pesquisa text check (public.status_valido(rnm_dec_pesquisa)),
  rnm_dec_ausencia_antecedentes text check (public.status_valido(rnm_dec_ausencia_antecedentes)),
  rnm_agendamiento text check (public.status_valido(rnm_agendamiento)),
  -- CRO
  cro_docs_ok text check (public.status_valido(cro_docs_ok)),
  cro_titulo_original text check (public.status_valido(cro_titulo_original)),
  cro_cert_nacimiento text check (public.status_valido(cro_cert_nacimiento)),
  cro_foto text check (public.status_valido(cro_foto)),
  cro_cpf text check (public.status_valido(cro_cpf)),
  cro_rnm text check (public.status_valido(cro_rnm)),
  cro_declaracion_estudios text check (public.status_valido(cro_declaracion_estudios)),
  cro_comprobante_ubicacion text check (public.status_valido(cro_comprobante_ubicacion)),
  cro_ficha_inscripcion text check (public.status_valido(cro_ficha_inscripcion)),
  cro_tasa_inscripcion text check (public.status_valido(cro_tasa_inscripcion)),
  cro_anuidad text check (public.status_valido(cro_anuidad)),
  cro_formulario_firmado text check (public.status_valido(cro_formulario_firmado)),
  cro_login_liberado text check (public.status_valido(cro_login_liberado)),
  cro_certificado_enviado text check (public.status_valido(cro_certificado_enviado)),
  observacoes text,
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text not null default '',
  origem text not null default 'site' check (origem in ('site', 'planilha', 'importacao'))
);
create index if not exists tramites_grupo on public.tramites (grupo);
create index if not exists tramites_aluno on public.tramites (aluno_chave);
create index if not exists tramites_atualizado on public.tramites (atualizado_em);

-- ---------- turmas: janelas de agendamento (aba "QT de alunos") ----------
create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  grupo text not null,
  janela_inicio date,
  janela_fim date,
  agendar_a_partir date,
  agendados int,
  total int,
  semanas int not null default 1,
  observacoes text,
  linha_origem int,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists turmas_grupo on public.turmas (grupo, janela_inicio);

-- ---------- histórico: cada campo alterado, por quem e quando ----------
create table if not exists public.historico (
  id bigint generated always as identity primary key,
  tramite_id uuid not null references public.tramites (id) on delete cascade,
  campo text not null,
  de text,
  para text,
  quem text not null default '',
  origem text not null default 'site',
  quando timestamptz not null default now()
);
create index if not exists historico_tramite on public.historico (tramite_id, quando desc);
create index if not exists historico_quando on public.historico (quando desc);

-- Antes de salvar: carimba data, autor e origem (o site não consegue falsificar).
create or replace function public.carimba_tramite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  via text := coalesce(current_setting('tramitacao.origem', true), '');
begin
  new.atualizado_em := now();
  if via in ('planilha', 'importacao') then
    new.origem := via;
    new.atualizado_por := coalesce(nullif(current_setting('tramitacao.quem', true), ''), via);
  else
    new.origem := 'site';
    new.atualizado_por := coalesce((select nome from public.perfis where id = auth.uid()), '');
  end if;
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.criado_em := coalesce(new.criado_em, now());
    new.modulo_finalizado := coalesce(new.modulo_finalizado, false);
    new.arquivado := coalesce(new.arquivado, false);
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.criado_em := old.criado_em;
    new.linha_origem := old.linha_origem;
  end if;
  new.aluno_chave := lower(regexp_replace(translate(new.nome,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'),
    '\s+', ' ', 'g'));
  new.aluno_chave := trim(regexp_replace(new.aluno_chave, '[^a-z ]', '', 'g'));
  return new;
end $$;
drop trigger if exists carimba_tramites on public.tramites;
create trigger carimba_tramites before insert or update on public.tramites
  for each row execute function public.carimba_tramite();

-- Depois de salvar: grava no histórico o que mudou.
create or replace function public.registra_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  a jsonb := to_jsonb(old);
  b jsonb := to_jsonb(new);
begin
  if current_setting('tramitacao.origem', true) = 'importacao' then
    return new;
  end if;
  for k in select jsonb_object_keys(b) loop
    if k in ('atualizado_em', 'atualizado_por', 'origem', 'aluno_chave') then
      continue;
    end if;
    if (a -> k) is distinct from (b -> k) then
      insert into public.historico (tramite_id, campo, de, para, quem, origem)
      values (new.id, k, a ->> k, b ->> k, new.atualizado_por, new.origem);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists historico_tramites on public.tramites;
create trigger historico_tramites after update on public.tramites
  for each row execute function public.registra_historico();

create or replace function public.carimba_turma()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.criado_em := coalesce(new.criado_em, now());
    new.semanas := coalesce(new.semanas, 1);
  end if;
  return new;
end $$;
drop trigger if exists carimba_turmas on public.turmas;
create trigger carimba_turmas before insert or update on public.turmas
  for each row execute function public.carimba_turma();

-- ---------- regras de acesso ----------
-- Só quem entrou com login vê. Editor e admin alteram. Só admin apaga.
alter table public.perfis enable row level security;
alter table public.tramites enable row level security;
alter table public.turmas enable row level security;
alter table public.historico enable row level security;

drop policy if exists "perfis: ver" on public.perfis;
create policy "perfis: ver" on public.perfis for select to authenticated using (true);
drop policy if exists "perfis: admin altera" on public.perfis;
create policy "perfis: admin altera" on public.perfis for update to authenticated
  using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

drop policy if exists "tramites: ver" on public.tramites;
create policy "tramites: ver" on public.tramites for select to authenticated using (true);
drop policy if exists "tramites: criar" on public.tramites;
create policy "tramites: criar" on public.tramites for insert to authenticated with check (public.pode_editar());
drop policy if exists "tramites: editar" on public.tramites;
create policy "tramites: editar" on public.tramites for update to authenticated
  using (public.pode_editar()) with check (public.pode_editar());
drop policy if exists "tramites: apagar" on public.tramites;
create policy "tramites: apagar" on public.tramites for delete to authenticated using (public.meu_papel() = 'admin');

drop policy if exists "turmas: ver" on public.turmas;
create policy "turmas: ver" on public.turmas for select to authenticated using (true);
drop policy if exists "turmas: criar" on public.turmas;
create policy "turmas: criar" on public.turmas for insert to authenticated with check (public.pode_editar());
drop policy if exists "turmas: editar" on public.turmas;
create policy "turmas: editar" on public.turmas for update to authenticated
  using (public.pode_editar()) with check (public.pode_editar());
drop policy if exists "turmas: apagar" on public.turmas;
create policy "turmas: apagar" on public.turmas for delete to authenticated using (public.pode_editar());

drop policy if exists "historico: ver" on public.historico;
create policy "historico: ver" on public.historico for select to authenticated using (true);

-- ---------- sincronização com a planilha do Google ----------
-- A planilha (Apps Script) fala com o banco só por estas duas funções, com uma chave própria.
-- A chave fica guardada aqui; troque-a quando quiser com:
--   update public.sync_config set chave = encode(extensions.gen_random_bytes(24), 'hex');
create table if not exists public.sync_config (
  id int primary key default 1 check (id = 1),
  chave text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  ultima_planilha timestamptz
);
insert into public.sync_config (id) values (1) on conflict (id) do nothing;
alter table public.sync_config enable row level security; -- ninguém lê pela página

-- Campos que a planilha pode mudar (os mesmos da tabela, menos os de controle).
create or replace function public.campos_sync()
returns text[] language sql immutable as $$
  select array[
    'nome','grupo','lote','pais','telefone','responsavel','status_geral','agendar','visa','prox_modulo',
    'modulo_finalizado','data_renovacao','renovacao_status','paquete_completo','paquete_grupo','produto','preco',
    'data_venda','pagamento','cpf','nascimento','rnm_numero_protocolo','rnm_numero',
    'cpf_condicion_fiscal','cpf_pasaporte_rostro','cpf_pasaporte','cpf_solicitado_sitio','cpf_correo_rfb','cpf_protocolo',
    'rnm_pasaporte','rnm_cert_nacimiento','rnm_antecedentes','rnm_extracto_bancario','rnm_declaracion','rnm_protocolo',
    'rnm_nacimiento','rnm_grus_pagos','rnm_dec_pesquisa','rnm_dec_ausencia_antecedentes','rnm_agendamiento',
    'cro_docs_ok','cro_titulo_original','cro_cert_nacimiento','cro_foto','cro_cpf','cro_rnm','cro_declaracion_estudios',
    'cro_comprobante_ubicacion','cro_ficha_inscripcion','cro_tasa_inscripcion','cro_anuidad','cro_formulario_firmado',
    'cro_login_liberado','cro_certificado_enviado','observacoes','arquivado']
$$;

-- Planilha → banco. Recebe linhas [{id?, linha, campos...}] já padronizadas pelo Apps Script.
-- Devolve [{linha, id, ok, erro}] para a planilha gravar o ID nas linhas novas.
create or replace function public.sync_receber(p_chave text, p_quem text, p_linhas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  saida jsonb := '[]'::jsonb;
  v_id uuid;
  sets text;
  k text;
begin
  if p_chave is distinct from (select chave from sync_config where id = 1) then
    raise exception 'chave de sincronização inválida';
  end if;
  perform set_config('tramitacao.origem', 'planilha', true);
  perform set_config('tramitacao.quem', coalesce(nullif(p_quem, ''), 'planilha'), true);
  for r in select * from jsonb_array_elements(p_linhas) loop
    begin
      v_id := nullif(r ->> 'id', '')::uuid;
      if v_id is null or not exists (select 1 from tramites where id = v_id) then
        insert into tramites (id, nome) values (coalesce(v_id, gen_random_uuid()), coalesce(nullif(r ->> 'nome', ''), '(sem nome)'))
        returning id into v_id;
      end if;
      sets := '';
      foreach k in array campos_sync() loop
        if r ? k then
          sets := sets || format('%I = (jsonb_populate_record(null::tramites, $1)).%I, ', k, k);
        end if;
      end loop;
      if sets <> '' then
        execute format('update tramites set %s atualizado_em = now() where id = $2', sets) using r, v_id;
      end if;
      saida := saida || jsonb_build_object('linha', r -> 'linha', 'id', v_id, 'ok', true);
    exception when others then
      saida := saida || jsonb_build_object('linha', r -> 'linha', 'id', v_id, 'ok', false, 'erro', sqlerrm);
    end;
  end loop;
  update sync_config set ultima_planilha = now() where id = 1;
  return saida;
end $$;

-- Banco → planilha. Devolve o que mudou no site depois de p_desde (e quais IDs foram apagados).
create or replace function public.sync_enviar(p_chave text, p_desde timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_chave is distinct from (select chave from sync_config where id = 1) then
    raise exception 'chave de sincronização inválida';
  end if;
  return jsonb_build_object(
    'agora', now(),
    'linhas', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.atualizado_em)
      from tramites t
      where t.atualizado_em > coalesce(p_desde, '-infinity') and (p_desde is null or t.origem = 'site')
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.sync_receber(text, text, jsonb) from public;
revoke all on function public.sync_enviar(text, timestamptz) from public;
grant execute on function public.sync_receber(text, text, jsonb) to anon, authenticated;
grant execute on function public.sync_enviar(text, timestamptz) to anon, authenticated;

-- Importação inicial (feita uma vez pelo administrador, com a chave de sincronização).
create or replace function public.importar(p_chave text, p_tramites jsonb, p_turmas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n1 int;
  n2 int;
begin
  if p_chave is distinct from (select chave from sync_config where id = 1) then
    raise exception 'chave de sincronização inválida';
  end if;
  perform set_config('tramitacao.origem', 'importacao', true);
  insert into tramites select * from jsonb_populate_recordset(null::tramites, p_tramites)
  on conflict (id) do nothing;
  get diagnostics n1 = row_count;
  if p_turmas is not null and jsonb_array_length(p_turmas) > 0 then
    insert into turmas select * from jsonb_populate_recordset(null::turmas, p_turmas)
    on conflict (id) do nothing;
    get diagnostics n2 = row_count;
  end if;
  return jsonb_build_object('tramites', n1, 'turmas', coalesce(n2, 0));
end $$;
revoke all on function public.importar(text, jsonb, jsonb) from public;
grant execute on function public.importar(text, jsonb, jsonb) to anon, authenticated;

-- ---------- tempo real (o time vê as mudanças dos colegas sem recarregar) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tramites') then
    alter publication supabase_realtime add table public.tramites;
  end if;
end $$;

-- ---------- depois de criar a sua conta ----------
-- update public.perfis set papel = 'admin' where email = 'seu-email@exemplo.com';
-- Para ver a chave de sincronização (usar no Apps Script e no importador):
-- select chave from public.sync_config;
