// Tramitação CS · acompanhamento de CPF, RNM e CRO dos alunos (Supabase).
// Só entra quem foi convidado. Visualizador só vê; Editor altera; Administrador também cuida da equipe.
(() => {
  // ---------- configuração das etapas ----------
  const DOCS = {
    cpf: {
      nome: "CPF",
      etapas: [
        ["cpf_condicion_fiscal", "Condición fiscal"],
        ["cpf_pasaporte_rostro", "Pasaporte + rostro"],
        ["cpf_pasaporte", "Pasaporte"],
        ["cpf_solicitado_sitio", "Solicitado en el sitio"],
        ["cpf_correo_rfb", "Correo RFB"],
        ["cpf_protocolo", "Protocolo / CPF emitido"],
      ],
    },
    rnm: {
      nome: "RNM",
      etapas: [
        ["rnm_pasaporte", "Pasaporte"],
        ["rnm_cert_nacimiento", "Certificado de nacimiento"],
        ["rnm_antecedentes", "Antecedentes"],
        ["rnm_extracto_bancario", "Extracto bancario"],
        ["rnm_declaracion", "Declaración RNM"],
        ["rnm_protocolo", "Protocolo"],
        ["rnm_nacimiento", "Fecha de nacimiento"],
        ["rnm_grus_pagos", "GRUs pagos"],
        ["rnm_dec_pesquisa", "Dec. pesquisa"],
        ["rnm_dec_ausencia_antecedentes", "Dec. ausencia antecedentes"],
        ["rnm_agendamiento", "Agendamiento hecho"],
      ],
    },
    cro: {
      nome: "CRO",
      etapas: [
        ["cro_docs_ok", "Docs ok"],
        ["cro_titulo_original", "Título original"],
        ["cro_cert_nacimiento", "Certificado de nacimiento"],
        ["cro_foto", "1 foto 3x4"],
        ["cro_cpf", "CPF"],
        ["cro_rnm", "RNM"],
        ["cro_declaracion_estudios", "Declaración de estudios"],
        ["cro_comprobante_ubicacion", "Comprobante de ubicación"],
        ["cro_ficha_inscripcion", "Ficha de inscripción"],
        ["cro_tasa_inscripcion", "Tasa de inscripción"],
        ["cro_anuidad", "Anuidad"],
        ["cro_formulario_firmado", "Formulario firmado"],
        ["cro_login_liberado", "Login liberado"],
        ["cro_certificado_enviado", "Certificado enviado"],
      ],
    },
  };
  const TODAS_ETAPAS = Object.entries(DOCS).flatMap(([doc, d]) => d.etapas.map(([campo, rot]) => ({ doc, campo, rot, nomeDoc: d.nome })));
  const ETAPA = Object.fromEntries(TODAS_ETAPAS.map((e) => [e.campo, e]));

  const STATUS_ETAPA = [
    "Pendiente", "Solicitado", "Enviado", "Executando", "OK", "Já possui", "Não precisa", "Renovar", "Revisar",
    "Traducir", "Traduciendo", "Transcripción", "Actualizar", "Actualizando", "Actualizar y traducir",
    "Liberar", "Agendar", "Agendado", "Pagar", "Firmar", "Corrigir", "En análisis", "Indeferido", "Arquivado",
    "RNM oficial", "RNM provisório", "Registro",
  ];
  const FEITO = new Set(["OK", "Já possui", "Não precisa", "RNM oficial", "RNM provisório", "Registro"]);
  const ANDAMENTO = new Set(["Solicitado", "Enviado", "Executando", "Traduciendo", "Actualizando", "Agendado", "En análisis", "Transcripción"]);
  const ACAO = new Set(["Renovar", "Revisar", "Traducir", "Actualizar", "Actualizar y traducir", "Liberar", "Agendar", "Pagar", "Firmar", "Corrigir"]);
  const classeStatus = (s) =>
    !s ? "vazio" : FEITO.has(s) ? "ok" : ANDAMENTO.has(s) ? "andamento" : ACAO.has(s) ? "acao" : s === "Indeferido" ? "erro" : s === "Arquivado" ? "neutro" : "pend";

  const STATUS_GERAL = ["Lead", "Promessa", "Pendiente", "Executando", "Stand by", "Concluído", "Já possui", "Não precisa", "Sem interesse"];
  const AGENDAR = ["Agendar", "Agendado", "Comunicado", "Renovar", "Pendiente", "OK", "Não"];
  const PAGAMENTO = ["Pago", "Pendiente", "Compromisso", "Compromisso atrasado", "Promessa", "Link enviado"];
  const VISA = ["Pendente", "OK"];
  const PRODUTOS = [
    "Pacote estudantil de grupo (CPF, RNM e CRO)", "Pacote estudantil individual (CPF, RNM e CRO)",
    "Pacote Mercosul individual (CPF, RNM e CRO)", "CRO", "RNM individual", "RNM + CRO", "RNM Mercosul",
    "Renovação RNM", "Renovação RNM + CRO", "Renovação RNM + renovação CRO", "Registro de visto",
  ];
  const PAPEIS = { leitor: "Visualizador", editor: "Editor", admin: "Administrador" };
  const PAPEIS_DESC = {
    admin: "Vê e altera tudo; convida e remove pessoas da equipe",
    editor: "Vê e altera alunos, etapas e turmas",
    leitor: "Só vê e exporta",
  };

  // Campos gerais da ficha do aluno: [campo, rótulo, tipo, opções]
  const CAMPOS_GERAIS = [
    ["status_geral", "Status geral", "lista", STATUS_GERAL],
    ["pagamento", "Pagamento", "lista", PAGAMENTO],
    ["agendar", "Agendar?", "lista", AGENDAR],
    ["visa", "Visto", "lista", VISA],
    ["grupo", "Turma", "texto"],
    ["lote", "Grupo (nº)", "numero"],
    ["prox_modulo", "Próximo módulo", "data"],
    ["modulo_finalizado", "Módulos finalizados", "simnao"],
    ["data_renovacao", "Data de renovação", "data"],
    ["renovacao_status", "Renovação", "lista", ["OK", "Finalizado"]],
    ["pais", "País", "texto"],
    ["telefone", "Telefone", "texto"],
    ["responsavel", "Responsável", "texto"],
    ["produto", "Produto vendido", "lista", PRODUTOS],
    ["preco", "Preço (R$)", "numero"],
    ["data_venda", "Data da venda", "data"],
    ["paquete_completo", "Pacote completo?", "simnao"],
    ["paquete_grupo", "Pacote em grupo?", "simnao"],
    ["cpf", "Nº do CPF", "texto"],
    ["nascimento", "Data de nascimento", "data"],
    ["rnm_numero_protocolo", "Protocolo RNM", "texto"],
    ["rnm_numero", "Nº do RNM", "texto"],
  ];
  const ROTULO = {
    nome: "Nome", observacoes: "Observações", arquivado: "Arquivado",
    ...Object.fromEntries(CAMPOS_GERAIS.map(([c, r]) => [c, r])),
    ...Object.fromEntries(TODAS_ETAPAS.map((e) => [e.campo, `${e.nomeDoc} › ${e.rot}`])),
  };

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hoje = () => new Date(new Date().toDateString());
  const dataBR = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
  const dataHora = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dias = (iso) => Math.round((new Date(iso + "T00:00:00") - hoje()) / 86400000);
  const moeda = (n) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const opcoes = (lista, atual, vazio = "—") =>
    `<option value="">${vazio}</option>` + lista.map((o) => `<option ${o === atual ? "selected" : ""}>${esc(o)}</option>`).join("") +
    (atual && !lista.includes(atual) ? `<option selected>${esc(atual)}</option>` : "");

  const configurado = Boolean(window.SUPABASE_URL && window.SUPABASE_KEY && window.supabase);
  const tipoLink = /[#&]type=(invite|recovery|signup|magiclink)/.exec(location.hash)?.[1] || null;
  // lock próprio: o padrão da biblioteca prende a sessão entre abas e, se uma aba travar, todas travam.
  const sb = configurado ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { lock: async (_nome, _espera, fn) => fn() } }) : null;
  const app = $("#app");

  let usuario = null;
  let tramites = [];
  let porId = new Map();
  let turmas = [];
  let canal = null;
  const podeEditar = () => ["editor", "admin"].includes(usuario?.papel);

  function progresso(t, doc) {
    const et = DOCS[doc].etapas;
    const feitos = et.filter(([c]) => FEITO.has(t[c])).length;
    return { feitos, total: et.length, completo: feitos === et.length };
  }
  const ativos = () => tramites.filter((t) => !t.arquivado);

  // ---------- avisos ----------
  let tAviso;
  function aviso(texto, tipo = "ok") {
    let el = $("#aviso");
    if (!el) {
      el = document.createElement("div");
      el.id = "aviso";
      document.body.appendChild(el);
    }
    el.className = "aviso " + tipo;
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(tAviso);
    tAviso = setTimeout(() => (el.hidden = true), tipo === "erro" ? 6000 : 2200);
  }

  // ---------- janelas ----------
  function janela(html, aoAbrir, { fixa = false, larga = false, aoFechar = null } = {}) {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo" + (larga ? " ficha-fundo" : "");
    fundo.innerHTML = `<div class="modal ${larga ? "larga" : ""}" role="dialog" aria-modal="true">${html}</div>`;
    const fechar = () => {
      if (!fundo.isConnected) return;
      fundo.remove();
      document.removeEventListener("keydown", tecla);
      aoFechar?.();
    };
    fundo.fechar = fechar;
    const tecla = (e) => e.key === "Escape" && !fixa && fechar();
    if (!fixa) fundo.addEventListener("mousedown", (e) => e.target === fundo && fechar());
    document.addEventListener("keydown", tecla);
    fundo.querySelectorAll("[data-fechar]").forEach((b) => (b.onclick = fechar));
    document.body.appendChild(fundo);
    fundo.querySelector("input, textarea, select, button")?.focus();
    aoAbrir?.(fundo.querySelector(".modal"), fechar);
    return fechar;
  }
  function mostrarErro(el, texto, ok = false) {
    el.hidden = false;
    el.textContent = texto;
    el.classList.toggle("ok", ok);
  }
  function ocupado(form, sim) {
    form.querySelectorAll("button, input, textarea, select").forEach((x) => (x.disabled = sim));
  }

  // ---------- sessão ----------
  async function carregarUsuario(session) {
    if (!session?.user) return (usuario = null);
    const { data: perfil } = await sb.from("perfis").select("nome, papel").eq("id", session.user.id).maybeSingle();
    usuario = { id: session.user.id, email: session.user.email, nome: perfil?.nome || session.user.email, papel: perfil?.papel || "leitor" };
  }

  async function carregarDados() {
    const todos = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb.from("tramites").select("*").order("nome").range(de, de + 999);
      if (error) throw error;
      todos.push(...data);
      if (data.length < 1000) break;
    }
    tramites = todos;
    porId = new Map(tramites.map((t) => [t.id, t]));
    const { data: tu } = await sb.from("turmas").select("*").order("janela_inicio");
    turmas = tu || [];
  }

  function ouvirMudancas() {
    if (canal) sb.removeChannel(canal);
    canal = sb
      .channel("tramites")
      .on("postgres_changes", { event: "*", schema: "public", table: "tramites" }, (p) => {
        if (p.eventType === "DELETE") {
          tramites = tramites.filter((t) => t.id !== p.old.id);
          porId.delete(p.old.id);
        } else {
          const atual = porId.get(p.new.id);
          if (atual) Object.assign(atual, p.new);
          else {
            tramites.push(p.new);
            porId.set(p.new.id, p.new);
          }
        }
        clearTimeout(ouvirMudancas.t);
        ouvirMudancas.t = setTimeout(() => !$(".modal-fundo") && rota(true), 600);
      })
      .subscribe();
  }

  async function iniciar() {
    if (!sb) {
      app.innerHTML = `<div class="vazio">Falta configurar a conexão com o banco (arquivo <code>config.js</code>).</div>`;
      return;
    }
    const erroLink = /error_description=([^&]+)/.exec(location.hash)?.[1];
    const { data: s } = await sb.auth.getSession();
    await carregarUsuario(s.session);
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, "", location.pathname + "#/");
    if (erroLink) alert("Esse link não vale mais (expirou ou já foi usado). Peça um link novo ao administrador.");
    // Nunca chamar o Supabase direto dentro deste aviso: a biblioteca está com o "cadeado" da sessão
    // e tudo trava (em todas as abas). Por isso o trabalho roda logo depois, com setTimeout.
    sb.auth.onAuthStateChange((evento, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(evento)) return;
      setTimeout(async () => {
        const antes = usuario?.id;
        await carregarUsuario(session);
        if (antes !== usuario?.id) entrouOuSaiu();
        else desenharConta();
      }, 0);
    });
    await entrouOuSaiu();
    if (tipoLink && usuario) definirSenha(tipoLink === "recovery" ? "Crie uma nova senha" : "Bem-vindo! Crie sua senha", true);
  }

  async function entrouOuSaiu() {
    $("#topo").hidden = !usuario;
    if (!usuario) {
      tramites = [];
      if (canal) sb.removeChannel(canal);
      return telaLogin();
    }
    desenharConta();
    app.innerHTML = `<div class="carregando">Carregando alunos…</div>`;
    try {
      await carregarDados();
    } catch (e) {
      app.innerHTML = `<div class="vazio erro">Não consegui carregar os dados: ${esc(e.message)}</div>`;
      return;
    }
    ouvirMudancas();
    rota();
  }

  // ---------- login ----------
  function telaLogin() {
    app.innerHTML = `
      <div class="login">
        <div class="login-caixa">
          <div class="brand grande"><span class="brand-mark">U</span><span><b>Tramitação CS</b><small>CPF · RNM · CRO · UniCPO</small></span></div>
          <p class="muted">Acesso restrito à equipe. Use o e-mail e a senha do convite que você recebeu.</p>
          <form id="fLogin">
            <label>E-mail<input type="email" name="email" required autocomplete="username"></label>
            <label>Senha<input type="password" name="senha" required autocomplete="current-password"></label>
            <p class="erro" hidden></p>
            <button class="btn">Entrar</button>
            <button type="button" class="link" id="esqueci">Esqueci a senha</button>
          </form>
        </div>
      </div>`;
    const f = $("#fLogin");
    const erro = $(".erro", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      ocupado(f, true);
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
      ocupado(f, false);
      if (error) mostrarErro(erro, /invalid/i.test(error.message) ? "E-mail ou senha incorretos." : error.message);
    };
    $("#esqueci").onclick = async () => {
      if (!f.email.value.trim()) return mostrarErro(erro, "Digite seu e-mail acima e clique de novo.");
      const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: location.origin + location.pathname });
      mostrarErro(erro, error ? error.message : "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.", !error);
    };
  }

  function definirSenha(titulo, obrigatoria = false) {
    janela(
      `<h2>${esc(titulo)}</h2>
       ${obrigatoria ? `<p class="muted">Crie a senha que você vai usar para entrar (mínimo de 8 caracteres).</p>` : ""}
       <form>
         <label>Nova senha<input type="password" name="senha" minlength="8" required autocomplete="new-password"></label>
         <label>Repita a senha<input type="password" name="senha2" minlength="8" required autocomplete="new-password"></label>
         <p class="erro" hidden></p>
         <div class="acoes-form">${obrigatoria ? "" : `<button type="button" class="btn-sec" data-fechar>Cancelar</button>`}<button class="btn">Salvar senha</button></div>
       </form>`,
      (m, fechar) => {
        const f = $("form", m);
        f.onsubmit = async (e) => {
          e.preventDefault();
          if (f.senha.value !== f.senha2.value) return mostrarErro($(".erro", m), "As senhas não são iguais.");
          ocupado(f, true);
          const { error } = await sb.auth.updateUser({ password: f.senha.value });
          ocupado(f, false);
          if (error) return mostrarErro($(".erro", m), /should be different/i.test(error.message) ? "A senha nova precisa ser diferente da anterior." : error.message);
          fechar();
          aviso("Senha salva.");
        };
      },
      { fixa: obrigatoria }
    );
  }

  function desenharConta() {
    const el = $("#conta");
    if (!usuario) return (el.innerHTML = "");
    el.innerHTML = `
      <details class="menu-conta">
        <summary title="${esc(usuario.email)}"><span class="avatar">${esc(usuario.nome[0]?.toUpperCase() || "?")}</span></summary>
        <div class="menu">
          <b>${esc(usuario.nome)}</b>
          <small>${esc(usuario.email)} · ${PAPEIS[usuario.papel]}</small>
          ${usuario.papel === "admin" ? `<a href="#/equipe">Equipe e permissões</a>` : ""}
          <button id="btnSenha">Trocar senha</button>
          <button id="btnSair">Sair</button>
        </div>
      </details>`;
    $("#btnSair").onclick = () => sb.auth.signOut();
    $("#btnSenha").onclick = () => definirSenha("Trocar senha");
    $$(".menu a", el).forEach((a) => a.addEventListener("click", () => $("details", el).removeAttribute("open")));
  }

  // ---------- rotas ----------
  function lerHash() {
    const [caminho, q] = location.hash.replace(/^#\/?/, "").split("?");
    return { partes: caminho.split("/").filter(Boolean), q: new URLSearchParams(q || "") };
  }
  let ultimaRota = null; // última página (não ficha) desenhada, para voltar ao fechar a ficha
  let voltandoDaFicha = false;
  function rota(silencioso = false) {
    if (!usuario) return;
    const { partes, q } = lerHash();
    const pag = partes[0] || "painel";
    if (pag === "aluno") {
      if (!ultimaRota) {
        ultimaRota = "#/alunos";
        listaAlunos(new URLSearchParams(), false);
      }
      $(".ficha-fundo")?.remove();
      return abrirFicha(partes[1]);
    }
    if (voltandoDaFicha) {
      voltandoDaFicha = false;
      silencioso = true;
    }
    $(".ficha-fundo")?.fechar?.();
    ultimaRota = location.hash || "#/";
    $$("#menu a[data-nav]").forEach((a) => a.classList.toggle("ativo", a.dataset.nav === pag));
    const y = window.scrollY;
    if (pag === "painel") painel();
    else if (pag === "alunos") listaAlunos(q, silencioso);
    else if (pag === "turmas") paginaTurmas();
    else if (pag === "agenda") paginaAgenda();
    else if (pag === "atualizacoes") paginaAtualizacoes();
    else if (pag === "equipe") paginaEquipe();
    else painel();
    if (silencioso) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => rota());
  const linkAlunos = (filtros) => "#/alunos?" + new URLSearchParams(filtros).toString();

  // ---------- painel ----------
  function painel() {
    const lista = ativos();
    const exec = lista.filter((t) => t.status_geral === "Executando");
    const conta = (arr, f) => arr.filter(f).length;
    const docsCompletos = Object.keys(DOCS).map((d) => ({ d, n: conta(exec, (t) => progresso(t, d).completo) }));

    // Gargalos: etapas não concluídas entre os alunos em execução
    const gargalos = TODAS_ETAPAS.map((e) => ({ ...e, n: conta(exec, (t) => !FEITO.has(t[e.campo]) && t[e.campo] !== "Arquivado") }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);
    const maxG = Math.max(1, ...gargalos.map((g) => g.n));

    const h = hoje().toISOString().slice(0, 10);
    const proxJanelas = turmas.filter((t) => (t.janela_fim || t.janela_inicio) >= h).slice(0, 8);
    const renov = lista
      .filter((t) => t.data_renovacao && dias(t.data_renovacao) <= 60 && dias(t.data_renovacao) >= -30 && t.renovacao_status !== "OK")
      .sort((a, b) => a.data_renovacao.localeCompare(b.data_renovacao));
    const pagPend = conta(exec, (t) => ["Pendiente", "Compromisso atrasado"].includes(t.pagamento));

    const paises = {};
    exec.forEach((t) => (paises[t.pais || "Sem país"] = (paises[t.pais || "Sem país"] || 0) + 1));
    const topPaises = Object.entries(paises).sort((a, b) => b[1] - a[1]).slice(0, 8);

    app.innerHTML = `
      <section class="cabeca"><h1>Painel</h1><p class="muted">${lista.length} trâmites · ${new Set(lista.map((t) => t.aluno_chave)).size} alunos · ${new Set(lista.map((t) => t.grupo).filter(Boolean)).size} turmas</p></section>
      <section class="kpis">
        <a class="kpi" href="${linkAlunos({ status: "Executando" })}"><b>${exec.length}</b><span>Em execução</span></a>
        <a class="kpi" href="${linkAlunos({ status: "Lead" })}"><b>${conta(lista, (t) => t.status_geral === "Lead")}</b><span>Leads</span></a>
        <a class="kpi" href="${linkAlunos({ status: "Promessa" })}"><b>${conta(lista, (t) => t.status_geral === "Promessa")}</b><span>Promessas</span></a>
        <a class="kpi alerta" href="${linkAlunos({ status: "Executando", pagamento: "pendente" })}"><b>${pagPend}</b><span>Em execução com pagamento pendente</span></a>
      </section>
      <section class="grade-3">
        ${docsCompletos
          .map(
            ({ d, n }) => `
          <a class="cartao doc" href="${linkAlunos({ status: "Executando", doc: d, situacao: "incompleto" })}">
            <div class="doc-topo"><h3>${DOCS[d].nome}</h3><span class="muted">${pct(n, exec.length)}% concluído</span></div>
            <div class="barra"><i style="width:${pct(n, exec.length)}%"></i></div>
            <p><b>${n}</b> de ${exec.length} alunos em execução concluíram · <b>${exec.length - n}</b> faltando</p>
          </a>`
          )
          .join("")}
      </section>
      <section class="grade-2">
        <div class="cartao">
          <h3>Onde os processos estão parados</h3>
          <p class="muted">Etapas ainda não concluídas entre os alunos em execução. Clique para ver quem são.</p>
          <ul class="barras">${gargalos
            .map(
              (g) => `<li><a href="${linkAlunos({ status: "Executando", etapa: g.campo, situacao: "pendente" })}">
                <span>${esc(g.nomeDoc)} › ${esc(g.rot)}</span><i style="width:${(g.n / maxG) * 100}%"></i><b>${g.n}</b></a></li>`
            )
            .join("")}</ul>
        </div>
        <div class="cartao">
          <h3>Próximas janelas de agendamento</h3>
          ${
            proxJanelas.length
              ? `<table class="mini"><thead><tr><th>Turma</th><th>Janela</th><th>Agendar a partir de</th><th>Agendados</th></tr></thead><tbody>${proxJanelas
                  .map(
                    (j) => `<tr><td><a href="${linkAlunos({ grupo: j.grupo })}">${esc(j.grupo)}</a></td><td>${dataBR(j.janela_inicio)} a ${dataBR(j.janela_fim)}</td>
                    <td>${dataBR(j.agendar_a_partir)}</td><td>${j.agendados ?? "—"}${j.total ? " / " + j.total : ""}</td></tr>`
                  )
                  .join("")}</tbody></table>`
              : `<p class="muted">Nenhuma janela futura cadastrada. Cadastre em <a href="#/turmas">Turmas</a>.</p>`
          }
          <h3 class="mt">Renovações nos próximos 60 dias</h3>
          ${
            renov.length
              ? `<ul class="lista-simples">${renov
                  .slice(0, 8)
                  .map((t) => `<li><a href="#/aluno/${t.id}">${esc(t.nome)}</a> <span class="muted">${esc(t.grupo || "")}</span><span class="${dias(t.data_renovacao) < 0 ? "tag erro" : "tag acao"}">${dataBR(t.data_renovacao)}</span></li>`)
                  .join("")}</ul>${renov.length > 8 ? `<a href="#/agenda">Ver todas (${renov.length})</a>` : ""}`
              : `<p class="muted">Nenhuma renovação próxima.</p>`
          }
          <h3 class="mt">Alunos em execução por país</h3>
          <ul class="lista-simples">${topPaises.map(([p, n]) => `<li><a href="${linkAlunos({ status: "Executando", pais: p })}">${esc(p)}</a><b>${n}</b></li>`).join("")}</ul>
        </div>
      </section>`;
  }

  // ---------- lista de alunos ----------
  const POR_PAGINA = 100;
  let selecionados = new Set();
  let mostrar = POR_PAGINA;

  function filtrar(q) {
    const busca = semAcento(q.get("busca") || "").trim();
    const digitos = busca.replace(/\D/g, "");
    const f = {
      grupo: q.get("grupo") || "",
      pais: q.get("pais") || "",
      status: q.get("status") || "",
      pagamento: q.get("pagamento") || "",
      doc: q.get("doc") || "",
      etapa: q.get("etapa") || "",
      situacao: q.get("situacao") || "",
      arquivados: q.get("arquivados") === "1",
    };
    return tramites.filter((t) => {
      if (!f.arquivados && t.arquivado) return false;
      if (f.grupo && t.grupo !== f.grupo) return false;
      if (f.pais && (t.pais || "Sem país") !== f.pais) return false;
      if (f.status && (t.status_geral || "Sem status") !== f.status) return false;
      if (f.pagamento === "pendente" ? !["Pendiente", "Compromisso atrasado"].includes(t.pagamento) : f.pagamento && t.pagamento !== f.pagamento) return false;
      if (f.etapa) {
        const v = t[f.etapa];
        if (f.situacao === "pendente" && (FEITO.has(v) || v === "Arquivado")) return false;
        if (f.situacao === "feito" && !FEITO.has(v)) return false;
        if (f.situacao && !["pendente", "feito"].includes(f.situacao) && v !== f.situacao) return false;
      } else if (f.doc) {
        const p = progresso(t, f.doc);
        if (f.situacao === "incompleto" && p.completo) return false;
        if (f.situacao === "completo" && !p.completo) return false;
      }
      if (busca) {
        const alvo = semAcento(`${t.nome} ${t.grupo || ""} ${t.pais || ""} ${t.observacoes || ""} ${t.rnm_numero || ""}`);
        const nums = [t.cpf, t.rnm_numero_protocolo, t.telefone].map((x) => String(x || "").replace(/\D/g, "")).join("|");
        if (!alvo.includes(busca) && !(digitos.length >= 4 && nums.includes(digitos))) return false;
      }
      return true;
    });
  }

  function chipDoc(t, d) {
    const p = progresso(t, d);
    const cls = p.completo ? "ok" : p.feitos === 0 ? "pend" : "andamento";
    return `<span class="chip ${cls}" title="${DOCS[d].nome}: ${p.feitos} de ${p.total} etapas concluídas">${DOCS[d].nome} ${p.feitos}/${p.total}</span>`;
  }

  function listaAlunos(q, silencioso) {
    if (!silencioso) {
      mostrar = POR_PAGINA;
      selecionados = new Set();
    }
    const res = filtrar(q);
    const valores = (campo, vazio) => [...new Set(tramites.map((t) => t[campo] || vazio).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt"));
    const sel = (nome, lista, atual, rot) =>
      `<label>${rot}<select name="${nome}"><option value="">Todos</option>${lista.map((v) => `<option ${v === atual ? "selected" : ""} value="${esc(v)}">${esc(v)}</option>`).join("")}</select></label>`;
    const etapaSel = q.get("etapa") || "";
    const docSel = q.get("doc") || "";
    const sit = q.get("situacao") || "";
    const opcoesSituacao = etapaSel
      ? [["pendente", "Não concluída"], ["feito", "Concluída"], ...STATUS_ETAPA.map((s) => [s, s])]
      : docSel
        ? [["incompleto", "Incompleto"], ["completo", "Completo"]]
        : [];

    app.innerHTML = `
      <section class="cabeca linha">
        <div><h1>Alunos</h1><p class="muted" id="contagem"></p></div>
        <div class="acoes">
          <button class="btn-sec" id="btnCsv">Exportar planilha</button>
          ${podeEditar() ? `<button class="btn" id="btnNovo">+ Novo aluno</button>` : ""}
        </div>
      </section>
      <form class="filtros" id="fFiltros">
        <label class="busca">Buscar<input name="busca" type="search" value="${esc(q.get("busca") || "")}" placeholder="Nome, CPF, protocolo, telefone…"></label>
        ${sel("grupo", valores("grupo"), q.get("grupo"), "Turma")}
        ${sel("pais", valores("pais", "Sem país"), q.get("pais"), "País")}
        ${sel("status", valores("status_geral", "Sem status"), q.get("status"), "Status geral")}
        <label>Pagamento<select name="pagamento"><option value="">Todos</option><option value="pendente" ${q.get("pagamento") === "pendente" ? "selected" : ""}>Pendente ou atrasado</option>${PAGAMENTO.map((p) => `<option ${p === q.get("pagamento") ? "selected" : ""}>${p}</option>`).join("")}</select></label>
        <label>Documento<select name="doc"><option value="">Todos</option>${Object.entries(DOCS).map(([k, d]) => `<option value="${k}" ${k === docSel ? "selected" : ""}>${d.nome}</option>`).join("")}</select></label>
        <label>Etapa<select name="etapa"><option value="">Todas</option>${Object.entries(DOCS)
          .filter(([k]) => !docSel || k === docSel)
          .map(([k, d]) => `<optgroup label="${d.nome}">${d.etapas.map(([c, r]) => `<option value="${c}" ${c === etapaSel ? "selected" : ""}>${esc(r)}</option>`).join("")}</optgroup>`)
          .join("")}</select></label>
        ${opcoesSituacao.length ? `<label>Situação<select name="situacao"><option value="">Qualquer</option>${opcoesSituacao.map(([v, r]) => `<option value="${esc(v)}" ${v === sit ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>` : ""}
        <label class="check"><input type="checkbox" name="arquivados" value="1" ${q.get("arquivados") === "1" ? "checked" : ""}> Arquivados</label>
        <a class="link" href="#/alunos">Limpar</a>
      </form>
      <div class="lote" id="lote" hidden></div>
      <div class="tabela-wrap"><table class="alunos">
        <thead><tr>${podeEditar() ? `<th><input type="checkbox" id="selTodos" title="Selecionar os que aparecem"></th>` : ""}<th>Aluno</th><th>Turma</th><th>País</th><th>Status</th><th>Pagamento</th><th>Documentos</th>${etapaSel ? `<th>${esc(ROTULO[etapaSel])}</th>` : ""}<th>Atualizado</th></tr></thead>
        <tbody id="corpo"></tbody>
      </table></div>
      <div class="mais" id="mais"></div>`;

    const desenharLinhas = () => {
      $("#contagem").textContent = `${res.length} ${res.length === 1 ? "trâmite" : "trâmites"} · ${new Set(res.map((t) => t.aluno_chave)).size} alunos`;
      $("#corpo").innerHTML =
        res
          .slice(0, mostrar)
          .map(
            (t) => `<tr data-id="${t.id}" class="${t.arquivado ? "arquivado" : ""}">
          ${podeEditar() ? `<td><input type="checkbox" data-sel="${t.id}" ${selecionados.has(t.id) ? "checked" : ""}></td>` : ""}
          <td><a href="#/aluno/${t.id}" class="nome">${esc(t.nome)}</a>${t.observacoes ? ` <span class="obs" title="${esc(t.observacoes)}">●</span>` : ""}</td>
          <td>${esc(t.grupo || "")}</td>
          <td>${esc(t.pais || "")}</td>
          <td>${t.status_geral ? `<span class="tag st-${semAcento(t.status_geral).replace(/\W/g, "")}">${esc(t.status_geral)}</span>` : ""}</td>
          <td>${t.pagamento ? `<span class="tag pg-${semAcento(t.pagamento).replace(/\W/g, "")}">${esc(t.pagamento)}</span>` : ""}</td>
          <td class="chips">${chipDoc(t, "cpf")}${chipDoc(t, "rnm")}${chipDoc(t, "cro")}</td>
          ${etapaSel ? `<td>${podeEditar() ? `<select class="st ${classeStatus(t[etapaSel])}" data-rapido="${t.id}">${opcoes(STATUS_ETAPA, t[etapaSel])}</select>` : `<span class="tag ${classeStatus(t[etapaSel])}">${esc(t[etapaSel] || "—")}</span>`}</td>` : ""}
          <td class="muted pequeno" title="${esc(t.atualizado_por || "")}">${dataHora(t.atualizado_em)}</td>
        </tr>`
          )
          .join("") || `<tr><td colspan="9" class="vazio">Nenhum aluno com esses filtros.</td></tr>`;
      $("#mais").innerHTML = res.length > mostrar ? `<button class="btn-sec" id="btnMais">Mostrar mais (${res.length - mostrar} restantes)</button>` : "";
      $("#btnMais")?.addEventListener("click", () => {
        mostrar += POR_PAGINA * 3;
        desenharLinhas();
      });
      $$("[data-sel]").forEach((c) =>
        c.addEventListener("change", () => {
          c.checked ? selecionados.add(c.dataset.sel) : selecionados.delete(c.dataset.sel);
          desenharLote();
        })
      );
      $$("[data-rapido]").forEach((s) =>
        s.addEventListener("change", async () => {
          s.className = "st " + classeStatus(s.value);
          await salvar(s.dataset.rapido, { [etapaSel]: s.value || null });
        })
      );
    };

    const desenharLote = () => {
      const el = $("#lote");
      el.hidden = selecionados.size === 0;
      if (el.hidden) return;
      el.innerHTML = `<b>${selecionados.size} selecionados</b>
        <select id="loteCampo"><option value="">Escolha o que alterar…</option>
          <optgroup label="Geral"><option value="status_geral">Status geral</option><option value="pagamento">Pagamento</option><option value="agendar">Agendar?</option><option value="visa">Visto</option><option value="prox_modulo">Próximo módulo</option></optgroup>
          ${Object.values(DOCS).map((d) => `<optgroup label="${d.nome}">${d.etapas.map(([c, r]) => `<option value="${c}">${esc(r)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <span id="loteValor"></span>
        <button class="btn" id="loteAplicar" disabled>Aplicar</button>
        <button class="link" id="loteLimpar">Desmarcar</button>`;
      const campo = $("#loteCampo");
      campo.onchange = () => {
        const c = campo.value;
        const lista = c === "status_geral" ? STATUS_GERAL : c === "pagamento" ? PAGAMENTO : c === "agendar" ? AGENDAR : c === "visa" ? VISA : STATUS_ETAPA;
        $("#loteValor").innerHTML = !c ? "" : c === "prox_modulo" ? `<input type="date" id="loteV">` : `<select id="loteV">${opcoes(lista, "", "(vazio)")}</select>`;
        $("#loteAplicar").disabled = !c;
      };
      $("#loteLimpar").onclick = () => {
        selecionados.clear();
        desenharLinhas();
        desenharLote();
      };
      $("#loteAplicar").onclick = async () => {
        const c = campo.value;
        const v = $("#loteV").value || null;
        if (!confirm(`Alterar "${ROTULO[c]}" para "${v || "(vazio)"}" em ${selecionados.size} trâmites?`)) return;
        $("#loteAplicar").disabled = true;
        const ids = [...selecionados];
        const { error } = await sb.from("tramites").update({ [c]: v }).in("id", ids);
        if (error) return aviso("Não consegui salvar: " + error.message, "erro");
        ids.forEach((id) => porId.get(id) && (porId.get(id)[c] = v));
        aviso(`${ids.length} trâmites atualizados.`);
        selecionados.clear();
        listaAlunos(q, true);
      };
    };

    desenharLinhas();
    desenharLote();

    const f = $("#fFiltros");
    const aplicar = () => {
      const d = new FormData(f);
      const p = {};
      for (const [k, v] of d) if (v) p[k] = v;
      if (p.etapa && p.doc && ETAPA[p.etapa]?.doc !== p.doc) delete p.etapa;
      if (p.situacao && !p.etapa && !p.doc) delete p.situacao;
      history.replaceState(null, "", linkAlunos(p));
      listaAlunos(new URLSearchParams(p), false);
      if (p.busca !== undefined) {
        const b = $("#fFiltros [name=busca]");
        b.focus();
        b.setSelectionRange(b.value.length, b.value.length);
      }
    };
    f.addEventListener("change", (e) => e.target.name !== "busca" && aplicar());
    let tb;
    f.busca.addEventListener("input", () => {
      clearTimeout(tb);
      tb = setTimeout(aplicar, 300);
    });
    f.onsubmit = (e) => {
      e.preventDefault();
      aplicar();
    };
    $("#selTodos")?.addEventListener("change", (e) => {
      res.slice(0, mostrar).forEach((t) => (e.target.checked ? selecionados.add(t.id) : selecionados.delete(t.id)));
      desenharLinhas();
      desenharLote();
    });
    $("#btnCsv").onclick = () => exportar(res);
    $("#btnNovo")?.addEventListener("click", novoAluno);
  }

  // ---------- salvar ----------
  async function salvar(id, mudanca) {
    const { data, error } = await sb.from("tramites").update(mudanca).eq("id", id).select().maybeSingle();
    if (error || !data) {
      aviso("Não consegui salvar: " + (error?.message || "sem permissão"), "erro");
      return false;
    }
    Object.assign(porId.get(id), data);
    aviso("Salvo.");
    return true;
  }

  // ---------- ficha do aluno ----------
  function abrirFicha(id) {
    const t = porId.get(id);
    if (!t) return aviso("Aluno não encontrado.", "erro");
    const ed = podeEditar();
    const outros = tramites.filter((x) => x.aluno_chave === t.aluno_chave && x.id !== t.id);
    const campo = ([c, rot, tipo, lista]) => {
      const v = t[c];
      let input;
      if (!ed) input = `<span class="valor">${esc(tipo === "data" ? dataBR(v) : tipo === "simnao" ? (v == null ? "" : v ? "Sim" : "Não") : tipo === "numero" && c === "preco" ? moeda(v) : v ?? "") || "—"}</span>`;
      else if (tipo === "lista") input = `<select data-campo="${c}">${opcoes(lista, v)}</select>`;
      else if (tipo === "simnao") input = `<select data-campo="${c}" data-tipo="simnao"><option value="">—</option><option value="1" ${v === true ? "selected" : ""}>Sim</option><option value="0" ${v === false ? "selected" : ""}>Não</option></select>`;
      else if (tipo === "data") input = `<input type="date" data-campo="${c}" value="${esc(v || "")}">`;
      else if (tipo === "numero") input = `<input type="number" step="any" data-campo="${c}" data-tipo="numero" value="${esc(v ?? "")}">`;
      else input = `<input data-campo="${c}" value="${esc(v ?? "")}" maxlength="200">`;
      return `<label class="campo"><span>${esc(rot)}</span>${input}</label>`;
    };
    const blocoDoc = (d) => {
      const p = progresso(t, d);
      return `<section class="bloco-doc">
        <header><h3>${DOCS[d].nome}</h3><span class="chip ${p.completo ? "ok" : p.feitos ? "andamento" : "pend"}">${p.feitos}/${p.total}</span>
        ${ed && !p.completo ? `<button class="link" data-tudook="${d}">Marcar tudo OK</button>` : ""}</header>
        <div class="etapas">${DOCS[d].etapas
          .map(
            ([c, rot]) => `<label class="etapa"><span>${esc(rot)}</span>${
              ed ? `<select class="st ${classeStatus(t[c])}" data-campo="${c}">${opcoes(STATUS_ETAPA, t[c])}</select>` : `<span class="tag ${classeStatus(t[c])}">${esc(t[c] || "—")}</span>`
            }</label>`
          )
          .join("")}</div>
      </section>`;
    };

    const fechar = janela(
      `<header class="ficha-topo">
        <div>
          ${ed ? `<input class="nome-grande" data-campo="nome" value="${esc(t.nome)}" maxlength="200">` : `<h2>${esc(t.nome)}</h2>`}
          <p class="muted">${esc(t.grupo || "Sem turma")} · ${esc(t.pais || "Sem país")}${t.arquivado ? " · <b>Arquivado</b>" : ""} · atualizado ${dataHora(t.atualizado_em)}${t.atualizado_por ? " por " + esc(t.atualizado_por) : ""}</p>
        </div>
        <button class="fechar" data-fechar aria-label="Fechar">×</button>
      </header>
      <div class="ficha">
        <div class="ficha-docs">${blocoDoc("cpf")}${blocoDoc("rnm")}${blocoDoc("cro")}</div>
        <aside class="ficha-dados">
          <h3>Dados do trâmite</h3>
          <div class="campos">${CAMPOS_GERAIS.map(campo).join("")}</div>
          <label class="campo largo"><span>Observações</span>${
            ed ? `<textarea data-campo="observacoes" rows="4">${esc(t.observacoes || "")}</textarea>` : `<p class="valor">${esc(t.observacoes || "—")}</p>`
          }</label>
          ${
            outros.length
              ? `<h3 class="mt">Mesmo aluno em outras turmas</h3><ul class="lista-simples">${outros
                  .map((o) => `<li><a href="#/aluno/${o.id}">${esc(o.grupo || "Sem turma")}</a><span class="muted">${esc(o.status_geral || "")}</span><span class="chips">${chipDoc(o, "cpf")}${chipDoc(o, "rnm")}${chipDoc(o, "cro")}</span></li>`)
                  .join("")}</ul>`
              : ""
          }
          <h3 class="mt">Histórico</h3>
          <div id="historico"><p class="muted">Carregando…</p></div>
          ${
            ed
              ? `<div class="acoes-ficha">
                  <button class="btn-sec" id="btnArquivar">${t.arquivado ? "Desarquivar" : "Arquivar"}</button>
                  ${usuario.papel === "admin" ? `<button class="btn-sec perigo" id="btnApagar">Apagar</button>` : ""}
                </div>`
              : ""
          }
        </aside>
      </div>`,
      (m) => {
        $$("[data-campo]", m).forEach((el) => {
          const ev = el.tagName === "SELECT" ? "change" : "change";
          el.addEventListener(ev, async () => {
            const c = el.dataset.campo;
            let v = el.value.trim();
            if (el.dataset.tipo === "simnao") v = v === "" ? null : v === "1";
            else if (el.dataset.tipo === "numero") v = v === "" ? null : Number(v);
            else if (v === "") v = null;
            if (c === "nome" && !v) {
              el.value = t.nome;
              return aviso("O nome não pode ficar vazio.", "erro");
            }
            if (c === "grupo" && v) v = v.toUpperCase().replace(/\s+/g, "");
            if (el.classList.contains("st")) el.className = "st " + classeStatus(v);
            const ok = await salvar(t.id, { [c]: v });
            if (ok) atualizarCabecalhosDoc(m, t);
            carregarHistorico(t.id);
          });
        });
        $$("[data-tudook]", m).forEach((b) =>
          b.addEventListener("click", async () => {
            const d = b.dataset.tudook;
            if (!confirm(`Marcar todas as etapas de ${DOCS[d].nome} como OK?`)) return;
            const mud = Object.fromEntries(DOCS[d].etapas.filter(([c]) => !FEITO.has(t[c])).map(([c]) => [c, "OK"]));
            if (await salvar(t.id, mud)) {
              Object.keys(mud).forEach((c) => {
                const s = $(`select[data-campo="${c}"]`, m);
                s.value = "OK";
                s.className = "st ok";
              });
              atualizarCabecalhosDoc(m, t);
              b.remove();
              carregarHistorico(t.id);
            }
          })
        );
        $("#btnArquivar", m)?.addEventListener("click", async () => {
          if (await salvar(t.id, { arquivado: !t.arquivado })) {
            fecharFicha();
          }
        });
        $("#btnApagar", m)?.addEventListener("click", async () => {
          if (!confirm(`Apagar de vez o trâmite de ${t.nome} (${t.grupo || "sem turma"})? Isso também apaga o histórico. Prefira "Arquivar".`)) return;
          const { error } = await sb.from("tramites").delete().eq("id", t.id);
          if (error) return aviso(error.message, "erro");
          tramites = tramites.filter((x) => x.id !== t.id);
          porId.delete(t.id);
          fecharFicha();
        });
        carregarHistorico(t.id);
      },
      {
        larga: true,
        // Fechar a ficha volta para a página de onde veio, sem perder filtros nem rolagem.
        aoFechar: () => {
          if (lerHash().partes[0] === "aluno") {
            voltandoDaFicha = true;
            location.hash = ultimaRota || "#/";
          }
        },
      }
    );
    const fecharFicha = fechar;
  }

  function atualizarCabecalhosDoc(m, t) {
    $$(".bloco-doc", m).forEach((b, i) => {
      const d = Object.keys(DOCS)[i];
      const p = progresso(t, d);
      const chip = $(".chip", b);
      chip.textContent = `${p.feitos}/${p.total}`;
      chip.className = `chip ${p.completo ? "ok" : p.feitos ? "andamento" : "pend"}`;
    });
  }

  async function carregarHistorico(id) {
    const el = $("#historico");
    if (!el) return;
    const { data, error } = await sb.from("historico").select("*").eq("tramite_id", id).order("quando", { ascending: false }).limit(50);
    if (error) return (el.innerHTML = `<p class="erro">${esc(error.message)}</p>`);
    el.innerHTML = data.length
      ? `<ul class="historico">${data
          .map(
            (h) => `<li><span class="muted pequeno">${dataHora(h.quando)} · ${esc(h.quem || "—")}${h.origem === "planilha" ? " (planilha)" : ""}</span>
            <span><b>${esc(ROTULO[h.campo] || h.campo)}</b>: ${esc(h.de ?? "—")} → ${esc(h.para ?? "—")}</span></li>`
          )
          .join("")}</ul>`
      : `<p class="muted">Nenhuma alteração desde a importação da planilha.</p>`;
  }

  function novoAluno() {
    const grupos = [...new Set(tramites.map((t) => t.grupo).filter(Boolean))].sort();
    janela(
      `<h2>Novo aluno</h2>
       <p class="muted">Cria o trâmite com todas as etapas como "Pendiente". O resto você preenche na ficha.</p>
       <form>
         <label>Nome completo<input name="nome" required maxlength="200"></label>
         <label>Turma<input name="grupo" list="listaGrupos" placeholder="Ex.: ORTOT63" required><datalist id="listaGrupos">${grupos.map((g) => `<option value="${esc(g)}">`).join("")}</datalist></label>
         <label>País<input name="pais" list="listaPaises"><datalist id="listaPaises">${[...new Set(tramites.map((t) => t.pais).filter(Boolean))].sort().map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
         <label>Produto vendido<select name="produto">${opcoes(PRODUTOS, PRODUTOS[0])}</select></label>
         <label>Status geral<select name="status_geral">${opcoes(STATUS_GERAL, "Lead")}</select></label>
         <p class="erro" hidden></p>
         <div class="acoes-form"><button type="button" class="btn-sec" data-fechar>Cancelar</button><button class="btn">Criar</button></div>
       </form>`,
      (m, fechar) => {
        const f = $("form", m);
        f.onsubmit = async (e) => {
          e.preventDefault();
          ocupado(f, true);
          const novo = {
            nome: f.nome.value.trim(),
            grupo: f.grupo.value.trim().toUpperCase().replace(/\s+/g, ""),
            pais: f.pais.value.trim() || null,
            produto: f.produto.value || null,
            status_geral: f.status_geral.value || null,
            ...Object.fromEntries(TODAS_ETAPAS.map((x) => [x.campo, "Pendiente"])),
          };
          const { data, error } = await sb.from("tramites").insert(novo).select().single();
          ocupado(f, false);
          if (error) return mostrarErro($(".erro", m), error.message);
          if (!porId.has(data.id)) {
            tramites.push(data);
            porId.set(data.id, data);
          }
          fechar();
          location.hash = "#/aluno/" + data.id;
        };
      }
    );
  }

  // ---------- exportar ----------
  function exportar(lista) {
    const cols = [
      ["grupo", "Nº Grupo"], ["nome", "Nombre"], ["pais", "Pais"], ["status_geral", "Status General"], ["agendar", "Agendar?"],
      ["visa", "Visa"], ["lote", "Grupo"], ["prox_modulo", "Próx. módulo"], ["data_renovacao", "Data renovação"],
      ["produto", "Producto vendido"], ["preco", "Precio"], ["data_venda", "Fecha de venda"], ["pagamento", "Pago?"],
      ["cpf", "CPF"], ["nascimento", "Nascimento"], ["rnm_numero_protocolo", "Protocolo RNM"], ["rnm_numero", "Nº RNM"],
      ...TODAS_ETAPAS.map((e) => [e.campo, `${e.nomeDoc} ${e.rot}`]),
      ["observacoes", "Observações"], ["atualizado_em", "Atualizado em"], ["atualizado_por", "Atualizado por"],
    ];
    const cel = (v) => {
      if (v == null) return "";
      if (typeof v === "boolean") return v ? "Sim" : "Não";
      const s = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? dataBR(String(v).slice(0, 10)) : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "﻿" + [cols.map((c) => c[1]).join(";"), ...lista.map((t) => cols.map(([c]) => cel(t[c])).join(";"))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `tramitacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- turmas ----------
  function paginaTurmas() {
    const g = {};
    for (const t of ativos()) {
      if (!t.grupo) continue;
      const x = (g[t.grupo] = g[t.grupo] || { grupo: t.grupo, n: 0, exec: 0, cpf: 0, rnm: 0, cro: 0, prox: null });
      x.n++;
      if (t.status_geral === "Executando") x.exec++;
      for (const d of ["cpf", "rnm", "cro"]) if (progresso(t, d).completo) x[d]++;
      if (t.prox_modulo && t.prox_modulo >= hoje().toISOString().slice(0, 10) && (!x.prox || t.prox_modulo < x.prox)) x.prox = t.prox_modulo;
    }
    const lista = Object.values(g).sort((a, b) => (a.prox || "9").localeCompare(b.prox || "9") || a.grupo.localeCompare(b.grupo));
    const barra = (a, n) => `<div class="mini-barra" title="${a} de ${n}"><i style="width:${pct(a, n)}%"></i><span>${pct(a, n)}%</span></div>`;
    const ed = podeEditar();
    app.innerHTML = `
      <section class="cabeca"><h1>Turmas</h1><p class="muted">${lista.length} turmas com alunos ativos. Ordenadas pelo próximo módulo.</p></section>
      <div class="tabela-wrap"><table class="turmas">
        <thead><tr><th>Turma</th><th>Alunos</th><th>Em execução</th><th>Próximo módulo</th><th>CPF</th><th>RNM</th><th>CRO</th></tr></thead>
        <tbody>${lista
          .map(
            (x) => `<tr><td><a href="${linkAlunos({ grupo: x.grupo })}"><b>${esc(x.grupo)}</b></a></td><td>${x.n}</td><td>${x.exec}</td>
            <td>${x.prox ? dataBR(x.prox) + ` <span class="muted pequeno">(${dias(x.prox)} dias)</span>` : "—"}</td>
            <td>${barra(x.cpf, x.n)}</td><td>${barra(x.rnm, x.n)}</td><td>${barra(x.cro, x.n)}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>

      <section class="cabeca linha mt"><div><h2>Janelas de agendamento</h2><p class="muted">Quando cada turma pode agendar (antiga aba "QT de alunos").</p></div>
        ${ed ? `<button class="btn" id="btnJanela">+ Nova janela</button>` : ""}</section>
      <div class="tabela-wrap"><table class="janelas">
        <thead><tr><th>Turma</th><th>Janela</th><th>Agendar a partir de</th><th>Agendados</th><th>Semanas</th><th>Obs.</th>${ed ? "<th></th>" : ""}</tr></thead>
        <tbody>${
          turmas
            .slice()
            .sort((a, b) => (b.janela_inicio || "").localeCompare(a.janela_inicio || ""))
            .map(
              (j) => `<tr class="${(j.janela_fim || j.janela_inicio || "") < hoje().toISOString().slice(0, 10) ? "passado" : ""}"><td><a href="${linkAlunos({ grupo: j.grupo })}">${esc(j.grupo)}</a></td>
              <td>${dataBR(j.janela_inicio)} a ${dataBR(j.janela_fim)}</td><td>${dataBR(j.agendar_a_partir)}</td>
              <td>${j.agendados ?? "—"}${j.total ? " / " + j.total : ""}</td><td>${j.semanas}</td><td>${esc(j.observacoes || "")}</td>
              ${ed ? `<td><button class="link" data-janela="${j.id}">Editar</button></td>` : ""}</tr>`
            )
            .join("") || `<tr><td colspan="7" class="vazio">Nenhuma janela cadastrada.</td></tr>`
        }</tbody>
      </table></div>`;
    $("#btnJanela")?.addEventListener("click", () => editarJanela(null));
    $$("[data-janela]").forEach((b) => b.addEventListener("click", () => editarJanela(turmas.find((j) => j.id === b.dataset.janela))));
  }

  function editarJanela(j) {
    janela(
      `<h2>${j ? "Editar janela" : "Nova janela de agendamento"}</h2>
       <form>
         <label>Turma<input name="grupo" required value="${esc(j?.grupo || "")}" placeholder="Ex.: ORTOT63"></label>
         <div class="dois"><label>Início<input type="date" name="janela_inicio" required value="${esc(j?.janela_inicio || "")}"></label>
         <label>Fim<input type="date" name="janela_fim" value="${esc(j?.janela_fim || "")}"></label></div>
         <label>Agendar a partir de<input type="date" name="agendar_a_partir" value="${esc(j?.agendar_a_partir || "")}"></label>
         <div class="dois"><label>Agendados<input type="number" min="0" name="agendados" value="${esc(j?.agendados ?? "")}"></label>
         <label>Total de alunos<input type="number" min="0" name="total" value="${esc(j?.total ?? "")}"></label></div>
         <label>Semanas<select name="semanas"><option ${j?.semanas !== 2 ? "selected" : ""}>1</option><option ${j?.semanas === 2 ? "selected" : ""}>2</option></select></label>
         <label>Observações<input name="observacoes" value="${esc(j?.observacoes || "")}"></label>
         <p class="erro" hidden></p>
         <div class="acoes-form">${j ? `<button type="button" class="btn-sec perigo" id="apagarJ">Apagar</button>` : ""}<button type="button" class="btn-sec" data-fechar>Cancelar</button><button class="btn">Salvar</button></div>
       </form>`,
      (m, fechar) => {
        const f = $("form", m);
        f.onsubmit = async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(f));
          for (const k of Object.keys(d)) if (d[k] === "") d[k] = null;
          d.grupo = d.grupo.toUpperCase().replace(/\s+/g, "");
          ["agendados", "total", "semanas"].forEach((k) => d[k] != null && (d[k] = Number(d[k])));
          ocupado(f, true);
          const r = j ? await sb.from("turmas").update(d).eq("id", j.id).select().single() : await sb.from("turmas").insert(d).select().single();
          ocupado(f, false);
          if (r.error) return mostrarErro($(".erro", m), r.error.message);
          turmas = j ? turmas.map((x) => (x.id === j.id ? r.data : x)) : [...turmas, r.data];
          fechar();
          paginaTurmas();
          aviso("Salvo.");
        };
        $("#apagarJ", m)?.addEventListener("click", async () => {
          if (!confirm("Apagar esta janela?")) return;
          const { error } = await sb.from("turmas").delete().eq("id", j.id);
          if (error) return mostrarErro($(".erro", m), error.message);
          turmas = turmas.filter((x) => x.id !== j.id);
          fechar();
          paginaTurmas();
        });
      }
    );
  }

  // ---------- agenda ----------
  function paginaAgenda() {
    const lista = ativos();
    const janelaDe = (g) => {
      const h = hoje().toISOString().slice(0, 10);
      return turmas.filter((j) => j.grupo === g && (j.janela_fim || j.janela_inicio) >= h).sort((a, b) => a.janela_inicio.localeCompare(b.janela_inicio))[0];
    };
    const prontos = lista
      .filter((t) => t.status_geral === "Executando" && FEITO.has(t.rnm_protocolo) && !FEITO.has(t.rnm_agendamiento))
      .map((t) => ({ t, j: janelaDe(t.grupo) }))
      .sort((a, b) => (a.j?.janela_inicio || "9").localeCompare(b.j?.janela_inicio || "9") || a.t.nome.localeCompare(b.t.nome));
    const renov = lista.filter((t) => t.data_renovacao && t.renovacao_status !== "OK" && t.renovacao_status !== "Finalizado").sort((a, b) => a.data_renovacao.localeCompare(b.data_renovacao));
    const ed = podeEditar();
    app.innerHTML = `
      <section class="cabeca"><h1>Agenda</h1></section>
      <section class="cartao">
        <h2>Prontos para agendar a Polícia Federal (RNM)</h2>
        <p class="muted">Em execução, com protocolo do RNM feito e agendamento ainda não feito (substitui a aba "Agendamentos da semana").</p>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Aluno</th><th>Turma</th><th>Protocolo</th><th>Nascimento</th><th>Janela da turma</th><th>Visto</th><th>Agendamento</th></tr></thead>
          <tbody>${
            prontos
              .map(
                ({ t, j }) => `<tr><td><a href="#/aluno/${t.id}">${esc(t.nome)}</a></td><td>${esc(t.grupo || "")}</td><td class="mono">${esc(t.rnm_numero_protocolo || "—")}</td>
                <td>${dataBR(t.nascimento)}</td><td>${j ? `${dataBR(j.janela_inicio)} a ${dataBR(j.janela_fim)}` : `<span class="muted">sem janela</span>`}</td>
                <td>${esc(t.visa || "")}</td>
                <td>${ed ? `<select class="st ${classeStatus(t.rnm_agendamiento)}" data-agenda="${t.id}">${opcoes(STATUS_ETAPA, t.rnm_agendamiento)}</select>` : esc(t.rnm_agendamiento || "")}</td></tr>`
              )
              .join("") || `<tr><td colspan="7" class="vazio">Ninguém aguardando agendamento.</td></tr>`
          }</tbody>
        </table></div>
      </section>
      <section class="cartao mt">
        <h2>Renovações de RNM</h2>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Status geral</th><th>Agendar?</th></tr></thead>
          <tbody>${
            renov
              .map((t) => {
                const d = dias(t.data_renovacao);
                return `<tr><td><span class="tag ${d < 0 ? "erro" : d <= 30 ? "acao" : "neutro"}">${dataBR(t.data_renovacao)}</span> <span class="muted pequeno">${d < 0 ? `venceu há ${-d} dias` : `em ${d} dias`}</span></td>
                <td><a href="#/aluno/${t.id}">${esc(t.nome)}</a></td><td>${esc(t.grupo || "")}</td><td>${esc(t.status_geral || "")}</td><td>${esc(t.agendar || "")}</td></tr>`;
              })
              .join("") || `<tr><td colspan="5" class="vazio">Nenhuma renovação pendente.</td></tr>`
          }</tbody>
        </table></div>
      </section>`;
    $$("[data-agenda]").forEach((s) =>
      s.addEventListener("change", async () => {
        s.className = "st " + classeStatus(s.value);
        await salvar(s.dataset.agenda, { rnm_agendamiento: s.value || null });
      })
    );
  }

  // ---------- atualizações ----------
  async function paginaAtualizacoes() {
    app.innerHTML = `<section class="cabeca"><h1>Últimas atualizações</h1><p class="muted">O que a equipe mudou (no site ou na planilha).</p></section><div class="cartao" id="ult"><p class="muted">Carregando…</p></div>`;
    const { data, error } = await sb.from("historico").select("*").order("quando", { ascending: false }).limit(300);
    if (error) return ($("#ult").innerHTML = `<p class="erro">${esc(error.message)}</p>`);
    $("#ult").innerHTML = data.length
      ? `<table><thead><tr><th>Quando</th><th>Quem</th><th>Aluno</th><th>O que mudou</th></tr></thead><tbody>${data
          .map((h) => {
            const t = porId.get(h.tramite_id);
            return `<tr><td class="pequeno">${dataHora(h.quando)}</td><td>${esc(h.quem || "—")}${h.origem === "planilha" ? ` <span class="tag neutro">planilha</span>` : ""}</td>
            <td>${t ? `<a href="#/aluno/${t.id}">${esc(t.nome)}</a> <span class="muted pequeno">${esc(t.grupo || "")}</span>` : "—"}</td>
            <td><b>${esc(ROTULO[h.campo] || h.campo)}</b>: ${esc(h.de ?? "—")} → ${esc(h.para ?? "—")}</td></tr>`;
          })
          .join("")}</tbody></table>`
      : `<p class="muted">Nenhuma alteração ainda.</p>`;
  }

  // ---------- equipe (só admin) ----------
  async function chamarEquipe(corpo) {
    const { data: d, error } = await sb.functions.invoke("equipe", { body: corpo });
    if (!error) return d || {};
    try {
      return { erro: (await error.context.json()).erro || error.message };
    } catch {
      return { erro: "Não consegui falar com o servidor: " + error.message };
    }
  }

  function mostrarLink(email, link, titulo = "Link de acesso", motivo = "O limite de e-mails grátis por hora foi atingido, então o convite não foi por e-mail.") {
    janela(
      `<h2>${esc(titulo)}</h2>
       <p>${esc(motivo)} Copie o link e envie para <b>${esc(email)}</b> (WhatsApp, por exemplo). Ao abrir, a pessoa cria a própria senha.</p>
       <textarea readonly rows="4" id="linkConvite">${esc(link)}</textarea>
       <p class="muted">O link vale por pouco tempo (normalmente 1 hora) e só pode ser usado uma vez.</p>
       <div class="acoes-form"><button class="btn-sec" data-fechar>Fechar</button><button class="btn" id="copiarLink">Copiar link</button></div>`,
      (m) => {
        $("#copiarLink", m).onclick = async () => {
          $("#linkConvite", m).select();
          try {
            await navigator.clipboard.writeText(link);
          } catch {
            document.execCommand("copy");
          }
          $("#copiarLink", m).textContent = "Copiado!";
        };
      }
    );
  }

  function definirSenhaDeOutro(id, email) {
    janela(
      `<h2>Definir senha</h2>
       <p>Nova senha de <b>${esc(email)}</b>. Depois é só passar o e-mail e essa senha para a pessoa entrar.</p>
       <form>
         <label>Senha<input type="text" name="senha" minlength="8" required autocomplete="off" spellcheck="false"></label>
         <p class="muted">Mínimo de 8 caracteres. A pessoa pode trocar depois em "Trocar senha".</p>
         <p class="erro" hidden></p>
         <div class="acoes-form"><button type="button" class="btn-sec" data-fechar>Cancelar</button><button class="btn">Salvar senha</button></div>
       </form>`,
      (m, fechar) => {
        const f = $("form", m);
        f.onsubmit = async (e) => {
          e.preventDefault();
          ocupado(f, true);
          const r = await chamarEquipe({ acao: "definir_senha", id, senha: f.senha.value });
          ocupado(f, false);
          if (r.erro) return mostrarErro($(".erro", m), r.erro);
          fechar();
          aviso(`Senha salva. ${email} já pode entrar.`);
        };
      }
    );
  }

  async function paginaEquipe() {
    if (usuario?.papel !== "admin") return (app.innerHTML = `<div class="vazio">Só o administrador acessa esta página.</div>`);
    app.innerHTML = `<section class="cabeca"><h1>Equipe e permissões</h1></section><div id="equipe"><p class="muted">Carregando…</p></div>`;
    const { data: perfis, error } = await sb.from("perfis").select("id, nome, email, papel").order("nome");
    const el = $("#equipe");
    if (error) return (el.innerHTML = `<p class="erro">${esc(error.message)}</p>`);
    const ops = (atual) => Object.keys(PAPEIS).map((k) => `<option value="${k}" ${atual === k ? "selected" : ""}>${PAPEIS[k]}</option>`).join("");
    el.innerHTML = `
      <form class="cartao convidar" id="fConvite">
        <h2>Convidar pessoa</h2>
        <div class="campos-linha">
          <label>Nome<input name="nome" required maxlength="120" placeholder="Ex.: Maria Souza"></label>
          <label>E-mail<input name="email" type="email" required placeholder="nome@exemplo.com"></label>
          <label>Permissão<select name="papel">${ops("editor")}</select></label>
          <button class="btn">Enviar convite</button>
        </div>
        <p class="muted" id="descPapel">${PAPEIS_DESC.editor}</p>
        <p class="erro" hidden></p>
      </form>
      <div class="tabela-wrap mt"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Permissão</th><th></th></tr></thead>
        <tbody>${perfis
          .map(
            (p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.email)}</td>
            <td><select data-perfil="${p.id}" ${p.id === usuario.id ? "disabled title='Você não pode mudar a sua própria permissão'" : ""}>${ops(p.papel)}</select></td>
            <td class="acoes-pessoa"><button class="link" data-definir="${p.id}" data-email="${esc(p.email)}">Definir senha</button>
            <button class="link" data-senha="${p.id}" data-email="${esc(p.email)}">Link de nova senha</button>
            ${p.id === usuario.id ? "" : `<button class="link perigo" data-remover="${p.id}" data-nome="${esc(p.nome)}">Remover acesso</button>`}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>`;
    const f = $("#fConvite");
    const erro = $(".erro", f);
    f.papel.addEventListener("change", () => ($("#descPapel").textContent = PAPEIS_DESC[f.papel.value]));
    f.onsubmit = async (e) => {
      e.preventDefault();
      erro.hidden = true;
      ocupado(f, true);
      const r = await chamarEquipe({ acao: "convidar", nome: f.nome.value.trim(), email: f.email.value.trim(), papel: f.papel.value, site: location.origin + location.pathname });
      ocupado(f, false);
      if (r.erro) return mostrarErro(erro, r.erro);
      if (r.link) return mostrarLink(f.email.value.trim(), r.link);
      mostrarErro(erro, `Convite enviado para ${f.email.value.trim()}.`, true);
      setTimeout(paginaEquipe, 1800);
    };
    $$("[data-definir]").forEach((b) => b.addEventListener("click", () => definirSenhaDeOutro(b.dataset.definir, b.dataset.email)));
    $$("[data-senha]").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        const r = await chamarEquipe({ acao: "senha", id: b.dataset.senha, site: location.origin + location.pathname });
        b.disabled = false;
        if (r.erro) return aviso(r.erro, "erro");
        mostrarLink(b.dataset.email, r.link, "Link de nova senha", "A senha atual continua valendo até a pessoa criar a nova.");
      })
    );
    $$("[data-remover]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm(`Remover o acesso de ${b.dataset.nome}?`)) return;
        b.disabled = true;
        const r = await chamarEquipe({ acao: "remover", id: b.dataset.remover });
        if (r.erro) {
          b.disabled = false;
          return aviso(r.erro, "erro");
        }
        paginaEquipe();
      })
    );
    $$("select[data-perfil]").forEach((s) =>
      s.addEventListener("change", async () => {
        s.disabled = true;
        const { error: e } = await sb.from("perfis").update({ papel: s.value }).eq("id", s.dataset.perfil);
        s.disabled = false;
        e ? aviso("Não consegui mudar: " + e.message, "erro") : aviso("Permissão alterada.");
      })
    );
  }

  iniciar();
})();
