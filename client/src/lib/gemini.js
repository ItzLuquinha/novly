const GEMINI_KEY_STORAGE = 'novly_gemini_key';
const MODEL = 'gemini-2.0-flash';

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key) {
  const trimmed = (key || '').trim();
  if (trimmed) localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  else localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export async function askLivrinho({ prompt, systemHint }) {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Configure a chave da API Gemini em Configuracoes para falar com o Livrinho.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            systemHint ||
            'Voce e o Livrinho, um livrozinho flutuante companheiro de escrita no app Novly. ' +
              'Fale em portugues do Brasil, tom caloroso, criativo e breve (no maximo 2 paragrafos curtos, a menos que peçam mais). ' +
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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      (res.status === 400 ? 'Chave ou pedido invalido.' : 'Livrinho nao conseguiu responder agora.');
    throw new Error(msg);
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') ||
    '';
  if (!text.trim()) throw new Error('Resposta vazia do Livrinho.');
  return text.trim();
}
