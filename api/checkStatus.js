// api/checkStatus.js
// Polls Telegram getUpdates directly — no database needed.
// NOTE: Do NOT register a Telegram webhook — getUpdates and webhooks are mutually exclusive.

export default async function handler(req, res) {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const TOKEN = process.env.TELEGRAM_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'Missing TELEGRAM_TOKEN' });

  try {
    // Fetch pending updates (callback_query only)
    const upResp = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getUpdates?allowed_updates=["callback_query"]&timeout=0`,
      { method: 'GET' }
    );
    const upData = await upResp.json();

    for (const update of (upData.result || [])) {
      const cb = update.callback_query;
      if (!cb || !cb.data) continue;

      // Match proceed_SESSIONID or decline_SESSIONID
      if (!cb.data.includes(sessionId)) continue;

      const action = cb.data.startsWith('proceed') ? 'proceed' : 'decline';

      // Acknowledge update so it won't appear again
      await fetch(
        `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${update.update_id + 1}&timeout=0`
      );

      // Answer the callback (removes loading spinner on button)
      await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: action === 'proceed' ? '✅ Approved' : '❌ Declined',
        }),
      });

      // Remove inline buttons from original message
      if (cb.message) {
        await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageReplyMarkup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            reply_markup: { inline_keyboard: [] },
          }),
        });
      }

      return res.status(200).json({ status: action });
    }

    return res.status(200).json({ status: 'pending' });

  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
