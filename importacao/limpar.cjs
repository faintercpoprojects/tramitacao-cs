// Lê a planilha original (Tramitacao.xlsx), padroniza os valores e gera:
//   saida/tramites.json  → uma linha por aluno em cada turma (aba "Trâmites")
//   saida/turmas.json    → janelas de agendamento por turma (aba "QT de alunos")
//   saida/relatorio.md   → o que foi corrigido, para conferência
// Uso: node limpar.cjs
const fs = require("fs");
const path = require("path");
const X = require("xlsx");

const dir = __dirname;
const wb = X.readFile(path.join(dir, "original", "Tramitacao.xlsx"), { cellDates: true });
const linhas = X.utils.sheet_to_json(wb.Sheets["Trâmites"], { header: 1, defval: "" });

const log = {}; // coluna → { "de → para": n }
const anota = (col, de, para) => {
  if (String(de) === String(para ?? "")) return;
  const k = `${JSON.stringify(String(de))} → ${para === null || para === undefined || para === "" ? "(vazio)" : JSON.stringify(String(para))}`;
  (log[col] = log[col] || {})[k] = (log[col][k] || 0) + 1;
};

const txt = (v) => (v instanceof Date ? v : String(v ?? "").replace(/\s+/g, " ").trim());
const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A planilha guarda datas como meia-noite de Brasília (03:00 UTC).
const isoData = (d) => {
  const x = new Date(d.getTime() - 3 * 3600 * 1000);
  return x.toISOString().slice(0, 10);
};
const dataTexto = (s) => {
  let m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) m = String(s).match(/^(\d{2})(\d{2})\/(\d{4})$/); // "1708/2026"
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

// ---------- vocabulário único de status das etapas ----------
const STATUS = {
  pendiente: "Pendiente",
  ok: "OK",
  solicitado: "Solicitado",
  enviado: "Enviado",
  "ja possui": "Já possui",
  "nao precisa": "Não precisa",
  executando: "Executando",
  executado: "OK",
  completo: "OK",
  renovar: "Renovar",
  revisar: "Revisar",
  traducir: "Traducir",
  traduciendo: "Traduciendo",
  transcripcion: "Transcripción",
  actualizar: "Actualizar",
  actualizando: "Actualizando",
  "actualizar y traducir": "Actualizar y traducir",
  liberado: "OK",
  liberar: "Liberar",
  agendar: "Agendar",
  agendado: "Agendado",
  pagar: "Pagar",
  pago: "OK",
  firmar: "Firmar",
  corrigir: "Corrigir",
  "en analise": "En análisis",
  indeferido: "Indeferido",
  arquivado: "Arquivado",
  // Correo RFB: por onde saiu o CPF
  "receita federal": "OK",
  "rfb ok": "OK",
  consulado: "OK",
  // CRO › RNM: tipo do RNM apresentado
  oficial: "RNM oficial",
  prov: "RNM provisório",
  "rnm prov": "RNM provisório",
  registro: "Registro",
};
const statusEtapa = (col, v) => {
  const t = txt(v);
  if (t === "") return null;
  const k = semAcento(t).replace(/!+$/, "").trim();
  const s = STATUS[k];
  if (s) {
    anota(col, t, s);
    return s;
  }
  return undefined; // não é status: o chamador decide
};

// ---------- colunas das etapas (ordem da planilha) ----------
const ETAPAS = [
  // [coluna na planilha, campo no banco]
  [15, "cpf_condicion_fiscal"],
  [16, "cpf_pasaporte_rostro"],
  [17, "cpf_pasaporte"],
  [18, "cpf_solicitado_sitio"],
  [19, "cpf_correo_rfb"],
  [20, "cpf_protocolo"],
  [21, "rnm_pasaporte"],
  [22, "rnm_cert_nacimiento"],
  [23, "rnm_antecedentes"],
  [24, "rnm_extracto_bancario"],
  [25, "rnm_declaracion"],
  [26, "rnm_protocolo"],
  [27, "rnm_nacimiento"],
  [28, "rnm_grus_pagos"],
  [29, "rnm_dec_pesquisa"],
  [30, "rnm_dec_ausencia_antecedentes"],
  [31, "rnm_agendamiento"],
  [32, "cro_docs_ok"],
  [33, "cro_titulo_original"],
  [34, "cro_cert_nacimiento"],
  [35, "cro_foto"],
  [36, "cro_cpf"],
  [37, "cro_rnm"],
  [38, "cro_declaracion_estudios"],
  [39, "cro_comprobante_ubicacion"],
  [40, "cro_ficha_inscripcion"],
  [41, "cro_tasa_inscripcion"],
  [42, "cro_anuidad"],
  [43, "cro_formulario_firmado"],
  [44, "cro_login_liberado"],
  [45, "cro_certificado_enviado"],
];

// ---------- campos gerais ----------
const PAISES = {
  ecuador: "Equador", equador: "Equador", peru: "Peru", honduras: "Honduras", colombia: "Colômbia",
  venezuela: "Venezuela", dominicana: "República Dominicana", domincana: "República Dominicana",
  "republica dominicana": "República Dominicana", chile: "Chile", guatemala: "Guatemala", mexico: "México",
  bolivia: "Bolívia", argentina: "Argentina", "el salvador": "El Salvador", "costa rica": "Costa Rica",
  panama: "Panamá", haiti: "Haiti", mocambique: "Moçambique", brasil: "Brasil", eua: "Estados Unidos",
  "estados unidos": "Estados Unidos",
};
const STATUS_GERAL = {
  executando: "Executando", executado: "Concluído", encerrado: "Concluído", ok: "Concluído",
  lead: "Lead", promessa: "Promessa", pendiente: "Pendiente", "ja possui": "Já possui",
  "stand by": "Stand by", standby: "Stand by", "estand by": "Stand by", standy: "Stand by",
  "no necesita": "Não precisa", "sin interese": "Sem interesse",
};
const AGENDAR = {
  agendar: "Agendar", renovar: "Renovar", ok: "OK", comunicado: "Comunicado", pendiente: "Pendiente",
  no: "Não", agendado: "Agendado",
};
const PAGO = {
  pago: "Pago", ok: "Pago", pendiente: "Pendiente", compromiso: "Compromisso", promessa: "Promessa",
  "comp atrasado": "Compromisso atrasado", link: "Link enviado",
};
const simNao = (col, v) => {
  const t = txt(v);
  if (!t) return null;
  const k = semAcento(t);
  const r = ["si", "sim", "ok"].includes(k) ? true : ["no", "nao"].includes(k) ? false : null;
  anota(col, t, r === null ? "" : r ? "Sim" : "Não");
  return r;
};
const mapa = (col, dic, v, extras) => {
  const t = txt(v);
  if (!t) return null;
  const k = semAcento(t).replace(/!+$/, "").trim();
  if (dic[k]) {
    anota(col, t, dic[k]);
    return dic[k];
  }
  if (extras) extras.push(`${col}: ${t}`);
  anota(col, t, "(movido para Observações)");
  return null;
};
const PRODUTOS = (t) => {
  const k = semAcento(t);
  if (!k) return null;
  if (/pacote estudantil de grupos|^pacote$/.test(k)) return "Pacote estudantil de grupo (CPF, RNM e CRO)";
  if (/pacote estudantil individual/.test(k)) return "Pacote estudantil individual (CPF, RNM e CRO)";
  if (/mercosul individual/.test(k)) return "Pacote Mercosul individual (CPF, RNM e CRO)";
  const temCro = /cro/.test(k);
  const renRnm = /renova\w* (de )?rnm|rnm renova/.test(k);
  const renCro = /renova\w* cro/.test(k);
  if (renRnm && renCro) return "Renovação RNM + renovação CRO";
  if (renRnm && temCro) return "Renovação RNM + CRO";
  if (renRnm) return "Renovação RNM";
  if (/rnm mercosul/.test(k)) return "RNM Mercosul";
  if (/rnm/.test(k) && temCro) return "RNM + CRO";
  if (/rnm/.test(k)) return "RNM individual";
  if (k === "cro") return "CRO";
  if (/visa/.test(k)) return "Registro de visto";
  return null;
};

const fmtCpf = (s) => {
  const d = String(s).replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const tramites = [];
const descartadas = [];
linhas.slice(1).forEach((x, i) => {
  const linha = i + 2;
  const nome = txt(x[5]);
  if (!nome) {
    if (x.some((v) => txt(v) !== "")) descartadas.push(linha);
    return;
  }
  const obs = [];
  const t = { linha_origem: linha, nome };

  // Grupo (nº do trâmite / semana)
  const g = txt(x[0]);
  if (/^\d+$/.test(g)) t.lote = Number(g);
  else if (g) obs.push(`Grupo: ${g}`);

  // OBS da planilha (VISA etc.)
  const o = txt(x[1]);
  t.visa = /visa ok/i.test(o) ? "OK" : /visa/i.test(o) ? "Pendente" : null;
  if (o && !/^visa( ok)?$/i.test(o)) obs.push(o);

  // Próximo módulo
  if (x[2] instanceof Date) t.prox_modulo = isoData(x[2]);
  else if (/finalizado/i.test(txt(x[2]))) t.modulo_finalizado = true;

  // Renovação
  if (x[3] instanceof Date) t.data_renovacao = isoData(x[3]);
  else {
    const r = txt(x[3]);
    const d = dataTexto(r);
    if (d) {
      t.data_renovacao = d;
      anota("Data Renovação", r, d.split("-").reverse().join("/"));
    } else if (/^ok$/i.test(r)) t.renovacao_status = "OK";
    else if (/finalizado/i.test(r)) t.renovacao_status = "Finalizado";
    else if (r) obs.push(`Renovação: ${r}`);
  }

  // País (alguns têm telefone no lugar)
  const p = txt(x[4]);
  if (p) {
    const k = semAcento(p);
    if (PAISES[k]) {
      t.pais = PAISES[k];
      anota("País", p, t.pais);
    } else if (/^[\d.,E+]+$/i.test(p)) {
      const n = Number(String(p).replace(",", "."));
      if (/E\+/i.test(p)) obs.push(`Telefone incompleto na planilha (${p})`);
      else t.telefone = String(Math.round(n));
      anota("País", p, "(telefone → campo Telefone)");
    } else obs.push(`País: ${p}`);
  }

  t.grupo = txt(x[6]).toUpperCase().replace(/\s+/g, "") || null;
  const sg = txt(x[7]);
  const skg = semAcento(sg).replace(/!+$/, "").trim();
  if (/^otavio$/.test(skg)) {
    t.responsavel = "Otávio";
    anota("Status General", sg, "(vazio; Otávio → Responsável)");
  } else t.status_geral = mapa("Status General", STATUS_GERAL, sg, obs);

  t.agendar = mapa("Agendar?", AGENDAR, x[8], obs);
  t.paquete_completo = simNao("Paquete completo?", x[9]);
  t.paquete_grupo = simNao("Paquete en grupo?", x[10]);

  const prod = txt(x[11]);
  t.produto = PRODUTOS(prod);
  if (prod && !t.produto && !/^ok$/i.test(prod)) obs.push(`Produto: ${prod}`);
  if (prod) anota("Producto vendido", prod, t.produto);

  const pr = x[12];
  if (typeof pr === "number") t.preco = pr;
  else if (/^\s*\d+\s*\+\s*\d+\s*$/.test(txt(pr))) {
    t.preco = txt(pr).split("+").reduce((a, b) => a + Number(b), 0);
    obs.push(`Preço: ${txt(pr)}`);
    anota("Precio", txt(pr), t.preco);
  }

  if (x[13] instanceof Date) t.data_venda = isoData(x[13]);
  t.pagamento = mapa("Pago?", PAGO, x[14], obs);

  // Etapas
  for (const [c, campo] of ETAPAS) {
    const v = x[c];
    const col = campo;
    if (v instanceof Date) {
      if (campo === "rnm_nacimiento") {
        t.nascimento = isoData(v);
        t[campo] = "OK";
        anota(col, "(data)", "OK + data em Nascimento");
      } else {
        t[campo] = "OK";
        obs.push(`${campo}: ${isoData(v)}`);
      }
      continue;
    }
    if (typeof v === "number") {
      const cpf = fmtCpf(String(v).padStart(11, "0"));
      if (campo === "cpf_protocolo" && cpf) {
        t.cpf = cpf;
        t[campo] = "OK";
        anota(col, "(número)", "OK + CPF");
      } else if (campo === "rnm_protocolo") {
        t.rnm_numero_protocolo = String(v);
        t[campo] = "OK";
      } else {
        t[campo] = "OK";
        obs.push(`${campo}: ${v}`);
      }
      continue;
    }
    const s = statusEtapa(col, v);
    if (s !== undefined) {
      t[campo] = s;
      continue;
    }
    // Não é status: é um dado (CPF, protocolo, nº de documento…)
    const bruto = txt(v);
    const cpf = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(bruto) ? fmtCpf(bruto) : null;
    if (cpf) {
      t.cpf = t.cpf || cpf;
      t[campo] = "OK";
      anota(col, "(CPF)", "OK + CPF");
    } else if (/^\d{10,}$/.test(bruto)) {
      t.rnm_numero_protocolo = bruto;
      t[campo] = "OK";
      anota(col, "(nº de protocolo)", "OK + Protocolo RNM");
    } else if (campo === "cro_rnm" && /^[A-Z]\d{6}[A-Z0-9]$/i.test(bruto)) {
      t.rnm_numero = bruto.toUpperCase();
      t[campo] = "OK";
      anota(col, "(nº do RNM)", "OK + Nº RNM");
    } else {
      t[campo] = "Pendiente";
      obs.push(`${campo}: ${bruto}`);
      anota(col, bruto, "Pendiente (valor em Observações)");
    }
  }
  t.observacoes = obs.join(" · ") || null;
  tramites.push(t);
});

// Chave do aluno (o mesmo aluno aparece em várias turmas)
const chave = (n) => semAcento(n).replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
for (const t of tramites) t.aluno_chave = chave(t.nome);

// ---------- QT de alunos → janelas de agendamento por turma ----------
const qt = X.utils.sheet_to_json(wb.Sheets["QT de alunos"], { header: 1, defval: "", raw: false, dateNF: "dd/mm" });
const turmas = [];
const anoBase = 2026;
const ddmm = (s, ref) => {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${ref}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
qt.slice(1).forEach((x, i) => {
  const grupo = txt(x[1]).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]+T\d+$/.test(grupo)) return;
  const jan = txt(x[2]).split(/\s*A\s*/i);
  const apartir = ddmm(txt(x[3]), anoBase);
  const qtd = txt(x[4]);
  const m = qtd.match(/^(\d+)\s*\/\s*(\d+)$/);
  turmas.push({
    linha_origem: i + 2,
    grupo,
    janela_inicio: ddmm(jan[0], anoBase),
    janela_fim: ddmm(jan[1] || "", anoBase),
    agendar_a_partir: apartir,
    agendados: m ? Number(m[1]) : null,
    total: m ? Number(m[2]) : /^\d+$/.test(qtd) ? Number(qtd) : null,
    semanas: /2/.test(txt(x[0])) ? 2 : 1,
    observacoes: [txt(x[5]), txt(x[6])].filter(Boolean).join(" · ") || null,
  });
});

// ---------- saída ----------
fs.mkdirSync(path.join(dir, "saida"), { recursive: true });
fs.writeFileSync(path.join(dir, "saida", "tramites.json"), JSON.stringify(tramites, null, 1));
fs.writeFileSync(path.join(dir, "saida", "turmas.json"), JSON.stringify(turmas, null, 1));

const alunos = new Set(tramites.map((t) => t.aluno_chave)).size;
let md = `# Limpeza da planilha Tramitação.xlsx\n\nGerado em ${new Date().toLocaleString("pt-BR")}.\n\n`;
md += `- Linhas com aluno importadas: **${tramites.length}** (${alunos} alunos diferentes; o mesmo aluno pode estar em mais de uma turma)\n`;
md += `- Linhas sem nome de aluno ignoradas: **${descartadas.length}** (linhas ${descartadas.slice(0, 30).join(", ")}${descartadas.length > 30 ? "…" : ""})\n`;
md += `- Janelas de agendamento por turma (aba QT de alunos): **${turmas.length}**\n`;
md += `- Linhas com algo movido para Observações: **${tramites.filter((t) => t.observacoes).length}**\n\n`;
md += `## Correções por coluna\n\n`;
for (const [col, m] of Object.entries(log)) {
  md += `### ${col}\n\n`;
  for (const [k, n] of Object.entries(m).sort((a, b) => b[1] - a[1])) md += `- ${k}: ${n}\n`;
  md += `\n`;
}
fs.writeFileSync(path.join(dir, "saida", "relatorio.md"), md);
console.log(`ok: ${tramites.length} trâmites, ${alunos} alunos, ${turmas.length} janelas de turma, ${descartadas.length} linhas vazias`);
