// Envia os dados limpos (saida/*.json) para o Supabase, uma única vez.
// Uso: node importar.cjs   (lê a chave de sincronização de segredo.txt)
// Não duplica: cada linha recebe um ID fixo derivado da linha da planilha.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dir = __dirname;
const cfg = fs.readFileSync(path.join(dir, "..", "config.js"), "utf8");
const URL_ = /SUPABASE_URL = "([^"]+)"/.exec(cfg)[1];
const KEY = /SUPABASE_KEY = "([^"]+)"/.exec(cfg)[1];
const CHAVE = fs.readFileSync(path.join(dir, "segredo.txt"), "utf8").trim();

// UUID estável a partir de um texto (mesma linha → mesmo ID, então rodar de novo não duplica).
const uuid = (s) => {
  const h = crypto.createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const tramites = JSON.parse(fs.readFileSync(path.join(dir, "saida", "tramites.json"), "utf8")).map((t) => ({
  ...t,
  id: uuid("tramite:" + t.linha_origem),
  modulo_finalizado: Boolean(t.modulo_finalizado),
  arquivado: false,
}));
const turmas = JSON.parse(fs.readFileSync(path.join(dir, "saida", "turmas.json"), "utf8")).map((t) => ({ ...t, id: uuid("turma:" + t.linha_origem) }));

async function rpc(nome, corpo) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${txt}`);
  return JSON.parse(txt);
}

(async () => {
  let n = 0;
  for (let i = 0; i < tramites.length; i += 300) {
    const r = await rpc("importar", { p_chave: CHAVE, p_tramites: tramites.slice(i, i + 300), p_turmas: i === 0 ? turmas : [] });
    n += r.tramites;
    console.log(`lote ${i / 300 + 1}:`, r);
  }
  console.log(`pronto: ${n} trâmites novos (de ${tramites.length}), ${turmas.length} janelas de turma`);
})().catch((e) => {
  console.error("erro:", e.message);
  process.exit(1);
});
