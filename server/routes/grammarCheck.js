const express = require('express');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.use(requireAuth, requireRole('escritor'));

const LT_ENDPOINT = 'https://api.languagetool.org/v2/check';
const MAX_TEXT_LENGTH = 15000;

const rateLimitState = { count: 0, windowStart: Date.now() };
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;

function checkRateLimit() {
  const now = Date.now();
  if (now - rateLimitState.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitState.count = 0;
    rateLimitState.windowStart = now;
  }
  if (rateLimitState.count >= RATE_LIMIT_MAX) {
    return false;
  }
  rateLimitState.count += 1;
  return true;
}

router.post('/check', async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.json({ matches: [] });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: 'Texto longo demais para verificar de uma vez.' });
  }

  if (!checkRateLimit()) {
    return res.status(429).json({
      error: 'Limite de verificacoes por minuto atingido. Aguarde um pouco e tente novamente.',
    });
  }

  try {
    const params = new URLSearchParams({
      text,
      language: 'pt-BR',
      enabledOnly: 'false',
    });

    const response = await fetch(LT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({
          error: 'O servico publico do LanguageTool esta ocupado agora. Tente novamente em instantes.',
        });
      }
      return res.status(502).json({ error: 'O corretor avancado nao respondeu corretamente.' });
    }

    const data = await response.json();
    const matches = (data.matches || []).map((m) => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      shortMessage: m.shortMessage || '',
      replacements: (m.replacements || []).slice(0, 5).map((r) => r.value),
      ruleId: m.rule?.id || '',
      category: m.rule?.category?.name || '',
    }));

    res.json({ matches });
  } catch (err) {
    res.status(502).json({ error: 'Nao foi possivel conectar ao corretor avancado agora.' });
  }
});

module.exports = router;
