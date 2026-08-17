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

export async function askLivrinho({ prompt, systemHint }) {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Configure a chave da API Gemini em Configuracoes para falar com o Livrinho.');
  }

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            systemHint ||
            'Voce e o Livrinho, um livrozinho flutuante companheiro de escrita no app Novly. ' +
              'Fale em portugues do Brasil, tom caloroso, criativo e breve (no maximo 2 paragrafos curtos, a menos que pecam mais). ' +
              'Ajude o escritor com ideias, dialogo, continuidade e desbloqueio criativo. ' +
              'Nao invente que voce publicou o texto; apenas sugira. Nao use emojis em excesso.',
        },
      ],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
    },
  };

  let lastError = 'Livrinho nao conseguiu responder agora.';
  for (const model of MODELS) {
    const { res, data } = await callModel(model, key, body);
    if (res.ok) {
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') || '';
      if (text.trim()) return text.trim();
      lastError = 'Resposta vazia do Livrinho.';
      continue;
    }
    lastError =
      data?.error?.message ||
      (res.status === 400 ? 'Chave ou pedido invalido.' : lastError);
    if (res.status === 404 || res.status === 400) continue;
    break;
  }

  throw new Error(lastError);
}
