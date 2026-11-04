/**
 * Tramitação CS · sincronização entre a planilha (aba "Trâmites") e a plataforma.
 *
 * - Quando alguém edita uma linha na planilha, a linha vai para a plataforma na hora.
 * - A cada 5 minutos, o que a equipe mudou na plataforma volta para a planilha.
 * - Cada linha tem um ID na última coluna ("ID plataforma"). Não apague nem edite essa coluna.
 *
 * Instalação (uma vez, pelo dono da planilha): veja planilha/COMO-INSTALAR.md.
 */

const ABA = "Trâmites";
const COL_ID = 47; // coluna AU
const LINHA_CABECALHO = 1;

// ---------- configuração (Extensões → Apps Script → Configurações do projeto → Propriedades do script) ----------
function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const c = {
    url: p.getProperty("SUPABASE_URL"),
    key: p.getProperty("SUPABASE_KEY"),
    chave: p.getProperty("CHAVE_SYNC"),
  };
  if (!c.url || !c.key || !c.chave) throw new Error("Faltam as propriedades SUPABASE_URL, SUPABASE_KEY e CHAVE_SYNC.");
  return c;
}

function rpc_(nome, corpo) {
  const c = cfg_();
  const r = UrlFetchApp.fetch(c.url + "/rest/v1/rpc/" + nome, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: c.key, Authorization: "Bearer " + c.key },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 300) throw new Error(nome + ": " + r.getResponseCode() + " " + r.getContentText());
  return JSON.parse(r.getContentText());
}

// ---------- padronização (mesmas regras da importação) ----------
const semAcento_ = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const chaveSimples_ = (s) => semAcento_(s).replace(/!+$/, "").trim();

const STATUS = {
  pendiente: "Pendiente", ok: "OK", solicitado: "Solicitado", enviado: "Enviado", "ja possui": "Já possui",
  "nao precisa": "Não precisa", executando: "Executando", executado: "OK", completo: "OK", renovar: "Renovar",
  revisar: "Revisar", traducir: "Traducir", traduciendo: "Traduciendo", transcripcion: "Transcripción",
  actualizar: "Actualizar", actualizando: "Actualizando", "actualizar y traducir": "Actualizar y traducir",
  liberado: "OK", liberar: "Liberar", agendar: "Agendar", agendado: "Agendado", pagar: "Pagar", pago: "OK",
  firmar: "Firmar", corrigir: "Corrigir", "en analise": "En análisis", "en analisis": "En análisis",
  indeferido: "Indeferido", arquivado: "Arquivado", "receita federal": "OK", "rfb ok": "OK", consulado: "OK",
  oficial: "RNM oficial", "rnm oficial": "RNM oficial", prov: "RNM provisório", "rnm prov": "RNM provisório",
  "rnm provisorio": "RNM provisório", registro: "Registro",
};
const PAISES = {
  ecuador: "Equador", equador: "Equador", peru: "Peru", honduras: "Honduras", colombia: "Colômbia",
  venezuela: "Venezuela", dominicana: "República Dominicana", domincana: "República Dominicana", "republica dominicana": "República Dominicana",
  chile: "Chile", guatemala: "Guatemala", mexico: "México", bolivia: "Bolívia", argentina: "Argentina",
  "el salvador": "El Salvador", "costa rica": "Costa Rica", panama: "Panamá", haiti: "Haiti",
  mocambique: "Moçambique", brasil: "Brasil", eua: "Estados Unidos", "estados unidos": "Estados Unidos",
};
const STATUS_GERAL = {
  executando: "Executando", executado: "Concluído", concluido: "Concluído", encerrado: "Concluído", ok: "Concluído",
  lead: "Lead", promessa: "Promessa", pendiente: "Pendiente", "ja possui": "Já possui", "stand by": "Stand by",
  standby: "Stand by", "estand by": "Stand by", standy: "Stand by", "no necesita": "Não precisa", "nao precisa": "Não precisa",
  "sin interese": "Sem interesse", "sem interesse": "Sem interesse",
};
const AGENDAR = { agendar: "Agendar", renovar: "Renovar", ok: "OK", comunicado: "Comunicado", pendiente: "Pendiente", no: "Não", nao: "Não", agendado: "Agendado" };
const PAGO = {
  pago: "Pago", ok: "Pago", pendiente: "Pendiente", compromiso: "Compromisso", compromisso: "Compromisso",
  promessa: "Promessa", "comp atrasado": "Compromisso atrasado", "compromisso atrasado": "Compromisso atrasado",
  link: "Link enviado", "link enviado": "Link enviado",
};

// Colunas da aba (A=0 … AT=45) → campo da plataforma
const ETAPAS = [
  [15, "cpf_condicion_fiscal"], [16, "cpf_pasaporte_rostro"], [17, "cpf_pasaporte"], [18, "cpf_solicitado_sitio"],
  [19, "cpf_correo_rfb"], [20, "cpf_protocolo"], [21, "rnm_pasaporte"], [22, "rnm_cert_nacimiento"],
  [23, "rnm_antecedentes"], [24, "rnm_extracto_bancario"], [25, "rnm_declaracion"], [26, "rnm_protocolo"],
  [27, "rnm_nacimiento"], [28, "rnm_grus_pagos"], [29, "rnm_dec_pesquisa"], [30, "rnm_dec_ausencia_antecedentes"],
  [31, "rnm_agendamiento"], [32, "cro_docs_ok"], [33, "cro_titulo_original"], [34, "cro_cert_nacimiento"],
  [35, "cro_foto"], [36, "cro_cpf"], [37, "cro_rnm"], [38, "cro_declaracion_estudios"],
  [39, "cro_comprobante_ubicacion"], [40, "cro_ficha_inscripcion"], [41, "cro_tasa_inscripcion"], [42, "cro_anuidad"],
  [43, "cro_formulario_firmado"], [44, "cro_login_liberado"], [45, "cro_certificado_enviado"],
];

function isoData_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd");
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) || s.match(/^(\d{2})(\d{2})\/(\d{4})$/); // "1708/2026"
  return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : null;
}
function dataPlanilha_(iso) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
const fmtCpf_ = (s) => {
  const d = String(s).replace(/\D/g, "");
  return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : null;
};
const simNao_ = (v) => {
  const k = semAcento_(v);
  return ["si", "sim", "ok"].includes(k) ? true : ["no", "nao"].includes(k) ? false : null;
};
const vazio_ = (v) => v === "" || v == null;
function produto_(v) {
  const t = String(v || "").trim();
  const k = semAcento_(t);
  if (!k || k === "ok") return null;
  if (/pacote estudantil de grupo|^pacote$/.test(k)) return "Pacote estudantil de grupo (CPF, RNM e CRO)";
  if (/pacote estudantil individual/.test(k)) return "Pacote estudantil individual (CPF, RNM e CRO)";
  if (/mercosul individual/.test(k)) return "Pacote Mercosul individual (CPF, RNM e CRO)";
  const cro = /cro/.test(k);
  const renRnm = /renova\w* (de )?rnm|rnm renova/.test(k);
  if (renRnm && /renova\w* cro/.test(k)) return "Renovação RNM + renovação CRO";
  if (renRnm && cro) return "Renovação RNM + CRO";
  if (renRnm) return "Renovação RNM";
  if (/rnm mercosul/.test(k)) return "RNM Mercosul";
  if (/rnm/.test(k) && cro) return "RNM + CRO";
  if (/rnm/.test(k)) return "RNM individual";
  if (k === "cro") return "CRO";
  if (/visa|visto/.test(k)) return "Registro de visto";
  return t;
}

// Linha da planilha → objeto da plataforma
function linhaParaObjeto_(x) {
  const o = {};
  o.lote = typeof x[0] === "number" ? x[0] : /^\d+$/.test(String(x[0]).trim()) ? Number(x[0]) : null;
  const obs = String(x[1] || "").trim();
  o.visa = /visa ok/i.test(obs) ? "OK" : /visa/i.test(obs) ? "Pendente" : null;
  if (x[2] instanceof Date) {
    o.prox_modulo = isoData_(x[2]);
    o.modulo_finalizado = false;
  } else {
    o.prox_modulo = null;
    o.modulo_finalizado = /finalizado/i.test(String(x[2]));
  }
  const ren = isoData_(x[3]);
  o.data_renovacao = ren;
  o.renovacao_status = !ren && /^ok$/i.test(String(x[3]).trim()) ? "OK" : !ren && /finalizado/i.test(String(x[3])) ? "Finalizado" : null;
  const pais = String(x[4] || "").trim();
  if (!/^[\d.,E+ ]+$/i.test(pais)) o.pais = PAISES[semAcento_(pais)] || pais || null; // telefone na coluna País: não mexe
  o.nome = String(x[5] || "").replace(/\s+/g, " ").trim();
  o.grupo = String(x[6] || "").toUpperCase().replace(/\s+/g, "") || null;
  o.status_geral = STATUS_GERAL[chaveSimples_(x[7])] || null;
  o.agendar = AGENDAR[chaveSimples_(x[8])] || null;
  o.paquete_completo = simNao_(x[9]);
  o.paquete_grupo = simNao_(x[10]);
  o.produto = produto_(x[11]);
  o.preco = typeof x[12] === "number" ? x[12] : null;
  o.data_venda = isoData_(x[13]);
  o.pagamento = PAGO[chaveSimples_(x[14])] || null;
  for (const [c, campo] of ETAPAS) {
    const v = x[c];
    if (vazio_(v)) {
      o[campo] = null;
      continue;
    }
    if (campo === "rnm_nacimiento" && (v instanceof Date || isoData_(v))) {
      o.nascimento = isoData_(v);
      o[campo] = "OK";
      continue;
    }
    const s = STATUS[chaveSimples_(v)];
    if (s) {
      o[campo] = s;
      continue;
    }
    const bruto = String(v).trim();
    const cpf =
      /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(bruto) ? fmtCpf_(bruto)
      : campo === "cpf_protocolo" && /^\d{9,11}$/.test(bruto) ? fmtCpf_(("00" + bruto).slice(-11))
      : null;
    if (cpf) {
      o.cpf = cpf;
      o[campo] = "OK";
    } else if (/^\d{18}$/.test(bruto)) {
      o.rnm_numero_protocolo = bruto.replace(/\D/g, "");
      o[campo] = "OK";
    } else if (campo === "cro_rnm" && /^[A-Z]\d{6}[A-Z0-9]$/i.test(bruto)) {
      o.rnm_numero = bruto.toUpperCase();
      o[campo] = "OK";
    } else {
      o[campo] = "Pendiente"; // valor desconhecido: a plataforma recusaria; deixa como pendente
    }
  }
  return o;
}

// Objeto da plataforma → linha da planilha (só as 46 colunas de dados)
function objetoParaLinha_(t, atual) {
  const x = atual ? atual.slice(0, 46) : new Array(46).fill("");
  x[0] = t.lote == null ? "" : t.lote;
  const obsOutros = String(x[1] || "").replace(/visa( ok)?/i, "").trim();
  x[1] = t.visa === "OK" ? "VISA OK" : t.visa === "Pendente" ? "VISA" : obsOutros;
  x[2] = t.modulo_finalizado ? "Finalizado!" : dataPlanilha_(t.prox_modulo);
  x[3] = t.data_renovacao ? dataPlanilha_(t.data_renovacao) : t.renovacao_status || "";
  x[4] = t.pais || "";
  x[5] = t.nome || "";
  x[6] = t.grupo || "";
  x[7] = t.status_geral === "Executando" ? "Executando!" : t.status_geral || "";
  x[8] = t.agendar || "";
  x[9] = t.paquete_completo == null ? "" : t.paquete_completo ? "Sí" : "No";
  x[10] = t.paquete_grupo == null ? "" : t.paquete_grupo ? "Sí" : "No";
  x[11] = t.produto || "";
  x[12] = t.preco == null ? "" : Number(t.preco);
  x[13] = dataPlanilha_(t.data_venda);
  x[14] = t.pagamento || "";
  for (const [c, campo] of ETAPAS) {
    let v = t[campo] || "";
    if (campo === "cpf_protocolo" && v === "OK" && t.cpf) v = t.cpf;
    if (campo === "rnm_protocolo" && v === "OK" && t.rnm_numero_protocolo) v = t.rnm_numero_protocolo;
    if (campo === "rnm_nacimiento" && v === "OK" && t.nascimento) v = dataPlanilha_(t.nascimento);
    x[c] = v;
  }
  return x;
}

// ---------- planilha → plataforma (ao editar) ----------
function aoEditar(e) {
  const aba = e.range.getSheet();
  if (aba.getName() !== ABA) return;
  const r0 = Math.max(e.range.getRow(), LINHA_CABECALHO + 1);
  const r1 = e.range.getLastRow();
  if (r1 < r0) return;
  if (e.range.getColumn() === COL_ID && e.range.getNumColumns() === 1) return; // mexeram só no ID
  const linhas = [];
  for (let r = r0; r <= r1; r++) linhas.push(r);
  enviarLinhas_(aba, linhas, e.user ? e.user.getEmail() : "");
}

function enviarLinhas_(aba, numeros, quem) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const dados = [];
    for (const r of numeros) {
      const x = aba.getRange(r, 1, 1, COL_ID).getValues()[0];
      if (!String(x[5] || "").trim()) continue; // sem nome: ignora
      const o = linhaParaObjeto_(x);
      o.id = String(x[COL_ID - 1] || "").trim() || null;
      o.linha = r;
      dados.push(o);
    }
    if (!dados.length) return;
    const nome = quem ? quem.split("@")[0] : "planilha";
    const res = rpc_("sync_receber", { p_chave: cfg_().chave, p_quem: nome + " (planilha)", p_linhas: dados });
    const erros = [];
    for (const r of res) {
      if (r.ok && r.id) aba.getRange(r.linha, COL_ID).setValue(r.id);
      if (!r.ok) erros.push("Linha " + r.linha + ": " + r.erro);
    }
    if (erros.length) SpreadsheetApp.getActive().toast(erros.join("\n"), "Não sincronizou", 15);
  } finally {
    lock.releaseLock();
  }
}

// ---------- plataforma → planilha (a cada 5 minutos) ----------
function sincronizar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const desde = props.getProperty("ULTIMA_LEITURA");
    if (!desde) throw new Error("Rode primeiro a função 'instalar'.");
    const r = rpc_("sync_enviar", { p_chave: cfg_().chave, p_desde: desde });
    const aba = SpreadsheetApp.getActive().getSheetByName(ABA);
    if (r.linhas.length) {
      const ultima = aba.getLastRow();
      const ids = ultima > LINHA_CABECALHO ? aba.getRange(LINHA_CABECALHO + 1, COL_ID, ultima - LINHA_CABECALHO, 1).getValues().map((v) => String(v[0])) : [];
      const onde = {};
      ids.forEach((id, i) => id && (onde[id] = i + LINHA_CABECALHO + 1));
      for (const t of r.linhas) {
        const n = onde[t.id];
        if (t.arquivado && !n) continue;
        if (n) {
          const atual = aba.getRange(n, 1, 1, 46).getValues()[0];
          aba.getRange(n, 1, 1, 46).setValues([objetoParaLinha_(t, atual)]);
        } else {
          const nova = objetoParaLinha_(t, null);
          nova.push(t.id);
          aba.appendRow(nova);
        }
      }
    }
    props.setProperty("ULTIMA_LEITURA", r.agora);
  } finally {
    lock.releaseLock();
  }
}

// ---------- instalação ----------
// 1) liga cada linha da planilha ao ID da plataforma (pelo nome + turma);
// 2) cria os gatilhos (ao editar e a cada 5 minutos);
// 3) coloca listas suspensas nas colunas de status.
function instalar() {
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA);
  if (!aba) throw new Error('Não encontrei a aba "' + ABA + '".');
  aba.getRange(LINHA_CABECALHO, COL_ID).setValue("ID plataforma (não apagar)").setFontWeight("bold").setBackground("#eeeeee");

  // Tudo o que está na plataforma hoje
  const r = rpc_("sync_enviar", { p_chave: cfg_().chave, p_desde: null });
  const porChave = {};
  const porLinha = {};
  for (const t of r.linhas) {
    const k = semAcento_(t.nome).replace(/[^a-z ]/g, "").replace(/\s+/g, " ") + "|" + (t.grupo || "");
    (porChave[k] = porChave[k] || []).push(t);
    if (t.linha_origem) porLinha[t.linha_origem] = t;
  }
  const ultima = aba.getLastRow();
  const vals = aba.getRange(LINHA_CABECALHO + 1, 1, ultima - LINHA_CABECALHO, COL_ID).getValues();
  const usados = {};
  let ligadas = 0;
  const semPar = [];
  vals.forEach((x, i) => {
    const n = i + LINHA_CABECALHO + 1;
    if (!String(x[5] || "").trim() || String(x[COL_ID - 1] || "").trim()) return;
    const k = semAcento_(x[5]).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim() + "|" + String(x[6] || "").toUpperCase().replace(/\s+/g, "");
    const cands = (porChave[k] || []).filter((t) => !usados[t.id]);
    const t = cands.find((c) => c.linha_origem === n) || cands[0];
    if (t) {
      usados[t.id] = true;
      aba.getRange(n, COL_ID).setValue(t.id);
      ligadas++;
    } else semPar.push(n);
  });
  // Linhas da planilha que não existem na plataforma: envia como novas
  if (semPar.length) enviarLinhas_(aba, semPar, "instalacao");

  // Gatilhos
  ScriptApp.getProjectTriggers().forEach((g) => ScriptApp.deleteTrigger(g));
  ScriptApp.newTrigger("aoEditar").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger("sincronizar").timeBased().everyMinutes(5).create();
  PropertiesService.getScriptProperties().setProperty("ULTIMA_LEITURA", r.agora);

  // Listas suspensas (aceitam o que já existe, mas sugerem os valores padrão)
  const lista = (vals) => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(true).build();
  const n = Math.max(ultima, 2000) - LINHA_CABECALHO;
  const STATUS_LISTA = ["Pendiente", "Solicitado", "Enviado", "Executando", "OK", "Já possui", "Não precisa", "Renovar", "Revisar", "Traducir", "Traduciendo", "Actualizar", "Agendar", "Agendado", "Pagar", "Firmar", "Corrigir", "En análisis", "Indeferido", "Arquivado"];
  for (const [c, campo] of ETAPAS) {
    if (["cpf_protocolo", "rnm_protocolo", "rnm_nacimiento"].includes(campo)) continue; // aceitam número/data
    const l = campo === "cro_rnm" ? ["Pendiente", "RNM oficial", "RNM provisório", "Registro", "Solicitado", "Executando", "OK", "Já possui"] : STATUS_LISTA;
    aba.getRange(LINHA_CABECALHO + 1, c + 1, n, 1).setDataValidation(lista(l));
  }
  aba.getRange(LINHA_CABECALHO + 1, 8, n, 1).setDataValidation(lista(["Lead", "Promessa", "Pendiente", "Executando!", "Stand by", "Concluído", "Já possui", "Não precisa", "Sem interesse"]));
  aba.getRange(LINHA_CABECALHO + 1, 9, n, 1).setDataValidation(lista(["Agendar", "Agendado", "Comunicado", "Renovar", "Pendiente", "OK", "Não"]));
  aba.getRange(LINHA_CABECALHO + 1, 15, n, 1).setDataValidation(lista(["Pago", "Pendiente", "Compromisso", "Compromisso atrasado", "Promessa", "Link enviado"]));

  SpreadsheetApp.getActive().toast(ligadas + " linhas ligadas à plataforma; " + semPar.length + " enviadas como novas.", "Sincronização instalada", 15);
}
