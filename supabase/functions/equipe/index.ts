// Função "equipe": só o administrador convida e remove pessoas da plataforma.
// Roda no Supabase (Edge Functions). Usa a chave secreta do próprio projeto, que nunca vai para o navegador.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PAPEIS = ["leitor", "editor", "admin"];
const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta(405, { erro: "Método não permitido" });

  // Projetos novos também expõem as chaves secretas novas em SUPABASE_SECRET_KEYS.
  let chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!chave) {
    try {
      chave = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"))[0] as string;
    } catch {
      chave = "";
    }
  }
  if (!chave) return resposta(500, { erro: "Chave secreta do projeto não encontrada na função." });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, chave, {
    auth: { persistSession: false },
  });

  // Quem está pedindo? Precisa estar logado e ser administrador.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: quem } = await admin.auth.getUser(token);
  if (!quem?.user) return resposta(401, { erro: "Entre no site para continuar." });
  const { data: perfil } = await admin.from("perfis").select("papel").eq("id", quem.user.id).maybeSingle();
  if (perfil?.papel !== "admin") return resposta(403, { erro: "Só o administrador pode fazer isso." });

  let corpo: Record<string, string>;
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: "Pedido inválido." });
  }

  if (corpo.acao === "convidar") {
    const email = String(corpo.email || "").trim().toLowerCase();
    const nome = String(corpo.nome || "").trim().slice(0, 120);
    const papel = PAPEIS.includes(corpo.papel) ? corpo.papel : "leitor";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta(400, { erro: "E-mail inválido." });
    // O link do convite abre no mesmo endereço de onde o administrador convidou.
    const site = String(corpo.site || "").startsWith("http") ? corpo.site : undefined;

    const opcoes = { data: { nome }, redirectTo: site };
    let usuario = null;
    let link: string | null = null;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, opcoes);
    if (!error) {
      usuario = data.user;
    } else if (/rate limit/i.test(error.message)) {
      // O e-mail grátis do Supabase só manda poucos e-mails por hora: gera o link para enviar por WhatsApp.
      const g = await admin.auth.admin.generateLink({ type: "invite", email, options: opcoes });
      if (g.error) return resposta(400, { erro: g.error.message });
      usuario = g.data.user;
      link = g.data.properties.action_link;
    } else if (/already|registered|exists/i.test(error.message)) {
      // Convidado antes mas nunca entrou: gera um link novo para criar a senha.
      const g = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: site } });
      if (g.error) return resposta(400, { erro: g.error.message });
      if (g.data.user.last_sign_in_at) return resposta(400, { erro: "Esse e-mail já tem acesso ao site. Mude a permissão na lista abaixo." });
      usuario = g.data.user;
      link = g.data.properties.action_link;
    } else {
      return resposta(400, { erro: error.message });
    }
    await admin.from("perfis").upsert({ id: usuario.id, email, nome: nome || email.split("@")[0], papel });
    return resposta(200, { ok: true, link });
  }

  if (corpo.acao === "senha") {
    // Link para a pessoa criar uma senha nova, sem depender de e-mail (o administrador manda por WhatsApp).
    const { data: alvo, error: e1 } = await admin.auth.admin.getUserById(String(corpo.id || ""));
    if (e1 || !alvo?.user?.email) return resposta(400, { erro: "Pessoa não encontrada." });
    const site = String(corpo.site || "").startsWith("http") ? corpo.site : undefined;
    const g = await admin.auth.admin.generateLink({ type: "recovery", email: alvo.user.email, options: { redirectTo: site } });
    if (g.error) return resposta(400, { erro: g.error.message });
    return resposta(200, { ok: true, link: g.data.properties.action_link });
  }

  if (corpo.acao === "definir_senha") {
    // O administrador digita a senha e passa para a pessoa (sem link nem e-mail).
    const senha = String(corpo.senha || "");
    if (senha.length < 8) return resposta(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
    const { error } = await admin.auth.admin.updateUserById(String(corpo.id || ""), { password: senha, email_confirm: true });
    if (error) return resposta(400, { erro: error.message });
    return resposta(200, { ok: true });
  }

  if (corpo.acao === "remover") {
    const id = String(corpo.id || "");
    if (id === quem.user.id) return resposta(400, { erro: "Você não pode remover o seu próprio acesso." });
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return resposta(400, { erro: error.message });
    return resposta(200, { ok: true });
  }

  return resposta(400, { erro: "Ação desconhecida." });
});
