/**
 * PLAN B — Cabina de emergencia BioCasa
 *
 * Failover entre dos servidores (Railway primario, Replit respaldo) movido
 * por el webhook de un bot de Telegram exclusivo de esta app.
 *
 * Seguridad:
 * - Login en 2 pasos: frase secreta (PLANB_AUTH_PHRASE) + OTP de 6 dígitos
 *   enviado por Telegram. Sesión de 15 minutos.
 * - Límite de 5 intentos de frase por IP cada 10 minutos.
 * - Webhook de Telegram verificado con secret token (HMAC derivado, estable
 *   en ambos servidores sin secretos adicionales).
 * - El bot solo responde en el chat autorizado (TELEGRAM_CHAT_ID).
 */
import crypto from "node:crypto";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();

const APP_NAME = "BioCasa";

// ---------- Config ----------
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const CHAT_ID = process.env["TELEGRAM_CHAT_ID"] ?? "";
const AUTH_PHRASE = process.env["PLANB_AUTH_PHRASE"] ?? "";
const RAILWAY_URL = (process.env["PLANB_RAILWAY_URL"] ?? "").replace(/\/$/, "");
const REPLIT_URL = (process.env["PLANB_REPLIT_URL"] ?? "").replace(/\/$/, "");

const IS_RAILWAY = Boolean(process.env["RAILWAY_ENVIRONMENT"] ?? process.env["RAILWAY_PROJECT_ID"]);
const SERVER_NAME = IS_RAILWAY ? "Railway (primario)" : "Replit (respaldo)";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Secret token del webhook: derivado de forma determinística para que ambos
// servidores lo calculen igual sin compartir otro secreto.
const WEBHOOK_SECRET = crypto
  .createHmac("sha256", BOT_TOKEN || "planb")
  .update("planb-webhook-" + APP_NAME)
  .digest("hex")
  .slice(0, 48);

// ---------- Estado en memoria ----------
type Otp = { code: string; expiresAt: number };
const otps = new Map<string, Otp>(); // otpToken -> otp
const sessions = new Map<string, number>(); // sessionToken -> expiresAt
const phraseAttempts = new Map<string, { count: number; resetAt: number }>();

const OTP_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 15 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = phraseAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    phraseAttempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function newToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function validSession(req: Request): boolean {
  const token = (req.headers["x-planb-session"] as string) ?? "";
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// ---------- Telegram ----------
async function tg(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function notify(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await tg("sendMessage", { chat_id: CHAT_ID, text });
  } catch {
    /* notificación best-effort */
  }
}

// ---------- Ping de servidores ----------
async function ping(baseUrl: string): Promise<{ alive: boolean; latencyMs: number | null }> {
  if (!baseUrl) return { alive: false, latencyMs: null };
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/healthz`, { signal: AbortSignal.timeout(6000) });
    return { alive: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { alive: false, latencyMs: null };
  }
}

// ---------- Rutas API ----------
router.post("/planb/login", (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Demasiados intentos. Espera 10 minutos." });
    return;
  }
  const phrase = String(req.body?.phrase ?? "");
  if (!AUTH_PHRASE || phrase !== AUTH_PHRASE) {
    res.status(401).json({ error: "Frase incorrecta" });
    return;
  }
  const code = String(crypto.randomInt(100000, 999999));
  const otpToken = newToken();
  otps.set(otpToken, { code, expiresAt: Date.now() + OTP_TTL_MS });
  void notify(`🔐 ${APP_NAME} Plan B: tu código de acceso es ${code} (vale 5 minutos). Servidor: ${SERVER_NAME}`);
  res.json({ otpToken, message: "Código enviado por Telegram" });
});

router.post("/planb/otp", (req, res) => {
  const otpToken = String(req.body?.otpToken ?? "");
  const code = String(req.body?.code ?? "");
  const otp = otps.get(otpToken);
  if (!otp || Date.now() > otp.expiresAt || otp.code !== code) {
    res.status(401).json({ error: "Código inválido o vencido" });
    return;
  }
  otps.delete(otpToken);
  const session = newToken();
  sessions.set(session, Date.now() + SESSION_TTL_MS);
  res.json({ session, expiresInMinutes: 15 });
});

router.get("/planb/status", async (req, res) => {
  if (!validSession(req)) {
    res.status(401).json({ error: "Sesión inválida" });
    return;
  }
  const [railway, replit, webhookInfo] = await Promise.all([
    ping(RAILWAY_URL),
    ping(REPLIT_URL),
    BOT_TOKEN
      ? fetch(`${TG_API}/getWebhookInfo`).then((r) => r.json()).catch(() => null)
      : Promise.resolve(null),
  ]);
  const webhookUrl: string =
    (webhookInfo as { result?: { url?: string } } | null)?.result?.url ?? "";
  let botOn = "desconocido";
  if (webhookUrl.startsWith(RAILWAY_URL) && RAILWAY_URL) botOn = "railway";
  else if (webhookUrl.startsWith(REPLIT_URL) && REPLIT_URL) botOn = "replit";
  else if (!webhookUrl) botOn = "libre (sin webhook)";
  res.json({
    servingFrom: SERVER_NAME,
    railway: { url: RAILWAY_URL, ...railway },
    replit: { url: REPLIT_URL, ...replit },
    bot: { webhookUrl, activeOn: botOn },
  });
});

router.post("/planb/failover", async (req, res) => {
  if (!validSession(req)) {
    res.status(401).json({ error: "Sesión inválida" });
    return;
  }
  const target = String(req.body?.target ?? "");
  const base = target === "railway" ? RAILWAY_URL : target === "replit" ? REPLIT_URL : "";
  if (!base) {
    res.status(400).json({ error: "target debe ser railway o replit (y su URL debe estar configurada)" });
    return;
  }
  const result = (await tg("setWebhook", {
    url: `${base}/api/planb/telegram-webhook`,
    secret_token: WEBHOOK_SECRET,
    drop_pending_updates: true,
  })) as { ok?: boolean; description?: string };
  if (!result?.ok) {
    res.status(502).json({ error: `Telegram rechazó el webhook: ${result?.description ?? "?"}` });
    return;
  }
  const label = target === "railway" ? "Railway (primario)" : "Replit (respaldo)";
  await notify(`🔀 ${APP_NAME}: el bot ahora apunta a ${label}\n${base}`);
  res.json({ ok: true, activeOn: target });
});

router.get("/planb/vault", (req, res) => {
  if (!validSession(req)) {
    res.status(401).json({ error: "Sesión inválida" });
    return;
  }
  res.json({ phrase: AUTH_PHRASE, botToken: BOT_TOKEN, chatId: CHAT_ID });
});

// Webhook de Telegram
router.post("/planb/telegram-webhook", async (req, res) => {
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (secret !== WEBHOOK_SECRET) {
    res.status(403).end();
    return;
  }
  res.json({ ok: true }); // responder rápido a Telegram
  const msg = req.body?.message;
  const chatId = String(msg?.chat?.id ?? "");
  const text = String(msg?.text ?? "").trim().toUpperCase();
  if (!chatId || chatId !== CHAT_ID) return; // solo chat autorizado
  if (text === "STATUS" || text === "/STATUS") {
    await notify(`📡 ${APP_NAME} hablando desde: ${SERVER_NAME}`);
  }
});

// ---------- Cabina (HTML) ----------
router.get("/planb", (_req, res) => {
  res.type("html").send(CABIN_HTML);
});

const CABIN_HTML = /* html */ `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME} — Cabina Plan B</title>
<style>
  body{font-family:system-ui,sans-serif;background:#151b14;color:#e8e6d9;max-width:640px;margin:0 auto;padding:16px}
  h1{font-size:1.3rem;color:#c9b458}
  .card{background:#1f2a1d;border:1px solid #3a4a35;border-radius:10px;padding:16px;margin:12px 0}
  input,button{font-size:1rem;padding:10px;border-radius:8px;border:1px solid #3a4a35;width:100%;box-sizing:border-box;margin:6px 0}
  input{background:#0f140e;color:#e8e6d9}
  button{background:#c9b458;color:#151b14;font-weight:700;cursor:pointer}
  button.alt{background:#5a7d4f;color:#fff}
  button.warn{background:#a44;color:#fff}
  .ok{color:#8fce6f}.bad{color:#e57373}.muted{color:#999;font-size:.85rem}
  pre{background:#0f140e;padding:10px;border-radius:8px;overflow-x:auto;font-size:.75rem;white-space:pre-wrap;word-break:break-all}
  .hidden{display:none}
</style></head><body>
<h1>🛖 ${APP_NAME} — Cabina de emergencia (Plan B)</h1>
<p class="muted">Sirviendo desde: <b>${SERVER_NAME}</b></p>

<div id="login" class="card">
  <h3>1. Frase secreta</h3>
  <input id="phrase" type="password" placeholder="Frase secreta">
  <button onclick="doLogin()">Entrar</button>
  <div id="loginMsg"></div>
</div>

<div id="otpBox" class="card hidden">
  <h3>2. Código por Telegram</h3>
  <input id="code" inputmode="numeric" placeholder="Código de 6 dígitos">
  <button onclick="doOtp()">Verificar</button>
  <div id="otpMsg"></div>
</div>

<div id="panel" class="hidden">
  <div class="card"><h3>Estado de los servidores</h3><div id="status">Cargando…</div>
    <button class="alt" onclick="loadStatus()">Actualizar estado</button></div>
  <div class="card"><h3>Mover el bot</h3>
    <button onclick="failover('railway')">⬅ VOLVER A RAILWAY (primario)</button>
    <button class="warn" onclick="failover('replit')">🚨 ACTIVAR RESPALDO REPLIT</button>
    <div id="failMsg"></div></div>
  <div class="card"><h3>Vault</h3>
    <button class="alt" onclick="loadVault()">Revelar frase y token</button>
    <div id="vault"></div></div>
  <div class="card"><h3>Comandos manuales (si la cabina no abre)</h3>
    <pre>ver estado del bot:
curl "https://api.telegram.org/bot&lt;TOKEN&gt;/getWebhookInfo"

mover bot a Railway:
curl "https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=${RAILWAY_URL}/api/planb/telegram-webhook&secret_token=${WEBHOOK_SECRET}"

mover bot a Replit:
curl "https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=${REPLIT_URL}/api/planb/telegram-webhook&secret_token=${WEBHOOK_SECRET}"</pre></div>
</div>

<script>
let otpToken="",session="";
const $=id=>document.getElementById(id);
async function api(path,opts={}){
  opts.headers=Object.assign({"Content-Type":"application/json","x-planb-session":session},opts.headers||{});
  const r=await fetch("/api/planb"+path,opts);const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||("Error "+r.status));return j;}
async function doLogin(){
  $("loginMsg").textContent="";
  try{const j=await api("/login",{method:"POST",body:JSON.stringify({phrase:$("phrase").value})});
    otpToken=j.otpToken;$("login").classList.add("hidden");$("otpBox").classList.remove("hidden");
  }catch(e){$("loginMsg").innerHTML='<span class="bad">'+e.message+'</span>';}}
async function doOtp(){
  $("otpMsg").textContent="";
  try{const j=await api("/otp",{method:"POST",body:JSON.stringify({otpToken,code:$("code").value})});
    session=j.session;$("otpBox").classList.add("hidden");$("panel").classList.remove("hidden");loadStatus();
  }catch(e){$("otpMsg").innerHTML='<span class="bad">'+e.message+'</span>';}}
function fmt(name,s){return "<b>"+name+"</b>: "+(s.alive?'<span class="ok">VIVO</span> ('+s.latencyMs+' ms)':'<span class="bad">CAÍDO</span>')+' <span class="muted">'+(s.url||"sin URL")+"</span>";}
async function loadStatus(){
  $("status").textContent="Cargando…";
  try{const j=await api("/status");
    $("status").innerHTML=fmt("Railway",j.railway)+"<br>"+fmt("Replit",j.replit)+
      "<br><b>Bot activo en</b>: "+j.bot.activeOn+' <span class="muted">'+(j.bot.webhookUrl||"")+"</span>";
  }catch(e){$("status").innerHTML='<span class="bad">'+e.message+'</span>';}}
async function failover(t){
  $("failMsg").textContent="Moviendo…";
  try{await api("/failover",{method:"POST",body:JSON.stringify({target:t})});
    $("failMsg").innerHTML='<span class="ok">Listo. El bot apunta a '+t+'.</span>';loadStatus();
  }catch(e){$("failMsg").innerHTML='<span class="bad">'+e.message+'</span>';}}
async function loadVault(){
  try{const j=await api("/vault");
    $("vault").innerHTML="<pre>Frase: "+j.phrase+"\\nToken bot: "+j.botToken+"\\nChat ID: "+j.chatId+"</pre>";
  }catch(e){$("vault").innerHTML='<span class="bad">'+e.message+'</span>';}}
</script></body></html>`;

export default router;
