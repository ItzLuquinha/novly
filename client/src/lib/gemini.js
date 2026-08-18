const GEMINI_KEY_STORAGE = 'novly_gemini_key';
const MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

export function getGeminiKey() {
  return sessionStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key) {
  const trimmed = (key || '').trim();
  if (trimmed) sessionStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  else sessionStorage.removeItem(GEMINI_KEY_STORAGE);
}

async function callModel(model, key, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function historyToGemini(history = []) {
  return history
    .filter((m) => m?.text && (m.role === 'user' || m.role === 'livrinho'))
    .slice(-12)
    .map((m) => ({
      role: m.role === 'livrinho' ? 'model' : 'user',
      parts: [{ text: String(m.text).slice(0, 7000) }],
    }));
}

export async function askLivrinho({ prompt, systemHint, history = [], temperature = 0.72, maxOutputTokens = 1600 }) {
  const key = getGeminiKey();
  if (!key) throw new Error('Configure a chave da API Gemini em Configuracoes para falar com o Livrinho.');

  const body = {
    systemInstruction: {
      parts: [{
        text: systemHint ||
          'Voce e o Livrinho, o assistente editorial do Novly. Fale em portugues do Brasil. ' +
          'Seja util, especifico e fiel ao canon fornecido. Nunca invente fatos do livro como se fossem verdade. ' +
          'Quando houver incerteza, diga que nao encontrou evidencia no contexto. Preserve a voz do escritor. ' +
          'Prefira diagnostico e alternativas a escrever tudo pelo autor. Nao afirme que alterou o manuscrito; apenas sugira mudancas.',
      }],
    },
    contents: [...historyToGemini(history), { role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  let lastError = 'Livrinho nao conseguiu responder agora.';
  for (const model of MODELS) {
    const { res, data } = await callModel(model, key, body);
    if (res.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
      if (text.trim()) return text.trim();
      lastError = 'Resposta vazia do Livrinho.';
      continue;
    }
    lastError = data?.error?.message || (res.status === 400 ? 'Chave ou pedido invalido.' : lastError);
    if (res.status === 404 || res.status === 400) continue;
    break;
  }
  throw new Error(lastError);
}
