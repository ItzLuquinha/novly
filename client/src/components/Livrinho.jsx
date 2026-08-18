import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { askLivrinho, getGeminiKey } from '../lib/gemini';
import './Livrinho.css';

const IDLE_MS = 8 * 60 * 1000;
const MAX_STORED_MESSAGES = 24;

const MODES = {
  escrever: {
    label: 'Escrever', icon: '✦', placeholder: 'Peça ajuda com a cena ou selecione um trecho...',
    actions: [
      { id: 'continuar', label: 'Continuar', type: 'insert', prompt: ({ editor }) => `Continue a partir do ponto atual. Entregue APENAS o texto novo, sem explicacao, mantendo voz, pessoa verbal, tempo verbal e ritmo do manuscrito.\n\nTrecho final:\n${editor.slice(-3000) || '(pagina em branco)'}` },
      { id: 'reescrever', label: 'Reescrever seleção', type: 'replace', requiresSelection: true, prompt: ({ selection }) => `Reescreva o trecho abaixo deixando-o mais claro, natural e forte, sem mudar acontecimentos, fatos ou voz. Entregue APENAS o texto revisado.\n\nTRECHO:\n${selection.text}` },
      { id: 'tensao', label: 'Mais tensão', type: 'replace', requiresSelection: true, prompt: ({ selection }) => `Aumente a tensao deste trecho com sutileza, preservando conteudo, voz e personagens. Evite melodrama. Entregue APENAS o trecho revisado.\n\nTRECHO:\n${selection.text}` },
      { id: 'dialogo', label: 'Próximo diálogo', type: 'insert', prompt: ({ editor }) => `Sugira a continuacao imediata do dialogo/cena. Entregue APENAS 4 a 8 falas/acoes que poderiam entrar no manuscrito, sem introduzir fatos que contradigam o canon.\n\nTrecho final:\n${editor.slice(-2600)}` },
    ],
  },
  analisar: {
    label: 'Analisar', icon: '⌕', placeholder: 'O que você quer diagnosticar neste capítulo?',
    actions: [
      { id: 'continuidade', label: 'Continuidade', prompt: () => 'Audite o capitulo atual contra o canon fornecido. Liste somente inconsistencias plausiveis, cada uma com: fato do texto, fato do canon e por que merece revisao. Se nao houver evidencia de contradicao, diga isso claramente.' },
      { id: 'cena', label: 'Diagnosticar cena', prompt: ({ editor }) => `Diagnostique a cena atual em: objetivo, conflito, mudanca, tensao, clareza espacial e gancho. Aponte no maximo 5 melhorias concretas e preserve a intencao do escritor.\n\nTrecho atual:\n${editor.slice(-6500)}` },
      { id: 'checkup', label: 'Checkup do capítulo', prompt: () => 'Faca um checkup editorial do capitulo atual: estrutura, ritmo, dialogo, descricao, continuidade, repeticoes e pontas abertas. Nao use notas numericas. Priorize o que realmente vale revisar.' },
      { id: 'voz', label: 'Voz dos personagens', prompt: ({ editor }) => `Analise apenas os personagens que aparecem neste trecho e compare fala/acao com as fichas do canon. Marque como coerente, incerto ou possivel quebra de voz, sempre citando a evidencia.\n\nTrecho:\n${editor.slice(-5500)}` },
      { id: 'extrair', label: 'Extrair Story Bible', prompt: ({ editor }) => `Leia o capitulo e sugira APENAS fatos novos que parecem merecer registro na Story Bible: personagens, lugares, objetos, relacoes, mudancas de localizacao e detalhes de canon. Nao grave nada e nao transforme inferencias em fatos. Separe CONFIRMADO NO TEXTO de POSSIVEL/INFERIDO.\n\nCapitulo:\n${editor.slice(-8500)}` },
    ],
  },
  canon: {
    label: 'Canon', icon: '◎', placeholder: 'Pergunte qualquer coisa sobre o seu próprio livro...',
    actions: [
      { id: 'resumo', label: 'Onde parei?', prompt: () => 'Me lembre onde a historia esta exatamente antes/durante este capitulo. Resuma acontecimentos recentes, personagens relevantes, objetos importantes, localizacoes atuais e pontas que parecem abertas. Seja conciso e factual.' },
      { id: 'onde', label: 'Onde estão agora?', prompt: () => 'Liste as localizacoes atuais conhecidas dos personagens e objetos relevantes neste ponto do livro. Diferencie local confirmado de local desconhecido. Nao invente.' },
      { id: 'relacoes', label: 'Relações importantes', prompt: () => 'Resuma as relacoes mais relevantes para este capitulo entre personagens, lugares e objetos. Destaque conflitos, posse, parentesco e conexoes que possam impactar a cena atual.' },
      { id: 'pontas', label: 'Pontas abertas', prompt: () => 'Com base apenas no contexto disponivel, liste perguntas, conflitos ou promessas narrativas que parecem ainda abertas. Separe fatos claros de inferencias.' },
    ],
  },
  brainstorm: {
    label: 'Brainstorm', icon: '◇', placeholder: 'Vamos testar possibilidades sem transformar ideia em canon...',
    actions: [
      { id: 'proxima', label: 'Próxima cena', prompt: () => 'Proponha 3 proximas cenas diferentes. Para cada uma: objetivo, conflito, virada e por que ela aproveita o canon atual. Trate tudo como hipotese, nao como fato.' },
      { id: 'caminhos', label: '3 caminhos', prompt: ({ editor }) => `O escritor pode estar travado. Ofereca 3 caminhos realmente diferentes para seguir, cada um em 3 linhas no maximo. Use o canon como restricao, nao como desculpa para repetir o obvio.\n\nFim atual:\n${editor.slice(-2200)}` },
      { id: 'foreshadow', label: 'Foreshadowing', prompt: () => 'Identifique 2 a 4 fatos/relacoes do canon que poderiam receber foreshadowing neste ponto sem estragar a revelacao. Sugira pistas discretas e diga qual informacao cada pista prepara.' },
      { id: 'twist', label: 'Testar plot twist', prompt: () => 'Crie 3 possibilidades de virada compativeis com o que ja existe. Para cada uma diga: pistas que sustentam, risco de contradicao e custo emocional. Nao trate nenhuma como canon.' },
    ],
  },
};

function chapterIdFromPath(pathname) {
  const match = pathname.match(/^\/escritor\/capitulos\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function readEditor() {
  const textarea = document.querySelector('[data-tour="editor-texto"] textarea');
  if (!textarea) return { text: '', selection: null, caret: 0 };
  const start = Number(textarea.selectionStart || 0);
  const end = Number(textarea.selectionEnd || start);
  return {
    text: textarea.value || '',
    caret: end,
    selection: end > start ? { start, end, text: (textarea.value || '').slice(start, end) } : null,
  };
}

function cleanGeneratedText(value) {
  return String(value || '').trim().replace(/^```(?:[a-z]+)?\s*/i, '').replace(/```$/, '').trim();
}

function compactValue(value, max = 420) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildContextText(ctx, editorText, scope) {
  if (!ctx) return `MANUSCRITO ATUAL:\n${editorText.slice(-7000)}`;
  const out = [];
  out.push(`LIVRO: ${ctx.book.title}`);
  if (ctx.book.synopsis) out.push(`SINOPSE: ${compactValue(ctx.book.synopsis, 1400)}`);
  if (ctx.book.writer_notes && scope !== 'chapter') out.push(`NOTAS PRIVADAS DO ESCRITOR: ${compactValue(ctx.book.writer_notes, 1000)}`);
  out.push(`CAPITULO ATUAL: ${ctx.chapter.title} (ordem ${Number(ctx.chapter.order_index) + 1}, ${ctx.chapter.status})`);
  out.push(`MANUSCRITO ATUAL:\n${String(editorText || ctx.chapter.content || '').slice(-9000)}`);

  if (scope !== 'chapter') {
    if (ctx.previous_chapters?.length) {
      out.push('CAPITULOS ANTERIORES (finais recentes):');
      ctx.previous_chapters.forEach((c) => out.push(`- ${c.title}: ${compactValue(c.ending_excerpt, 750)}`));
    }
    if (ctx.scenes?.length) {
      out.push('CENAS PLANEJADAS/REGISTRADAS NESTE CAPITULO:');
      ctx.scenes.forEach((s) => out.push(`- ${s.title}: ${compactValue(s.summary, 500)}`));
    }
  }

  if (scope !== 'chapter') {
    const bible = ctx.story_bible || {};
    if (bible.characters?.length) {
      out.push('PERSONAGENS DO CANON:');
      bible.characters.forEach((c) => out.push(`- ${c.name}: ${compactValue([c.description,c.personality,c.goals,c.fears,c.relationships,c.history,c.notes].filter(Boolean).join(' | '), 900)}`));
    }
    if (bible.places?.length) {
      out.push('LUGARES DO CANON:');
      bible.places.forEach((p) => out.push(`- ${p.name}: ${compactValue([p.region,p.description,p.atmosphere,p.dangers,p.rules,p.history,p.notes].filter(Boolean).join(' | '), 750)}`));
    }
    if (bible.objects?.length) {
      out.push('OBJETOS DO CANON:');
      bible.objects.forEach((o) => out.push(`- ${o.name}: ${compactValue([o.category,o.description,o.significance,o.owner_current,o.current_location,o.origin,o.powers,o.condition,o.history,o.notes].filter(Boolean).join(' | '), 750)}`));
    }
    if (bible.relationships?.length) {
      out.push('RELACOES DO CANON:');
      bible.relationships.forEach((r) => out.push(`- ${r.source_name} -> ${r.label} -> ${r.target_name}${r.reveal_chapter_title ? ` (revelacao: ${r.reveal_chapter_title})` : ''}`));
    }
    if (bible.current_locations?.length) {
      out.push('LOCALIZACOES CONHECIDAS NESTE PONTO:');
      bible.current_locations.forEach((l) => out.push(`- ${l.entity_name}: ${l.place_name}${l.note ? ` (${compactValue(l.note, 250)})` : ''}; desde ${l.since_chapter}`));
    }
    if (ctx.timeline?.length) {
      out.push('TIMELINE:');
      ctx.timeline.slice(-40).forEach((e) => out.push(`- ${e.title}${e.chapter_title ? ` [${e.chapter_title}]` : ''}: ${compactValue(e.description, 450)}`));
    }
    if (ctx.planning?.length) {
      out.push('PLANEJAMENTO/KANBAN:');
      ctx.planning.slice(0, 30).forEach((k) => out.push(`- [${k.status}] ${k.title}: ${compactValue(k.description, 350)}`));
    }
  }
  return out.join('\n').slice(0, scope === 'full' ? 36000 : 18000);
}

function systemPrompt(contextText, mode) {
  return `Voce e o Livrinho, assistente editorial integrado ao Novly. Responda em portugues do Brasil.\n\nREGRAS:\n- O contexto abaixo e a fonte de verdade do livro. Nunca invente fatos como se fossem canon.\n- Quando nao encontrar evidencia suficiente, diga isso explicitamente.\n- Diferencie fatos do canon de sugestoes/hipoteses.\n- Preserve a voz e a intencao do escritor; seja editor e parceiro, nao dono da obra.\n- Nao diga que alterou, salvou ou publicou o manuscrito.\n- Em analises, cite nomes/capitulos/fatos concretos sempre que puder.\n- Modo atual: ${mode}.\n\nCONTEXTO PRIVADO DO NOVLY:\n${contextText}`;
}

function welcome(context) {
  if (context?.book?.title && context?.chapter?.title) {
    return `Estou com ${context.book.title} · ${context.chapter.title} aberto. Posso escrever com você, checar continuidade, consultar o canon ou testar ideias.`;
  }
  return 'Sou o Livrinho. Abra um capítulo para eu conectar suas perguntas ao manuscrito e à Story Bible.';
}

export default function Livrinho() {
  const location = useLocation();
  const chapterId = useMemo(() => chapterIdFromPath(location.pathname), [location.pathname]);
  const onEditor = Boolean(chapterId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('escrever');
  const [scope, setScope] = useState('full');
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [idleReady, setIdleReady] = useState(false);
  const [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState('');
  const lastTypeRef = useRef(Date.now());
  const listRef = useRef(null);

  const memoryKey = `novly_livrinho_v2:${chapterId || 'global'}`;

  const refreshContext = useCallback(async () => {
    if (!chapterId) { setContext(null); return; }
    setContextLoading(true); setContextError('');
    try {
      const data = await api.livrinhoContext(chapterId);
      setContext(data);
    } catch (err) {
      setContextError(err.message || 'Nao consegui ler o contexto do livro.');
    } finally { setContextLoading(false); }
  }, [chapterId]);

  useEffect(() => { if (chapterId) refreshContext(); else setContext(null); }, [chapterId, refreshContext]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(memoryKey) || '[]');
      if (Array.isArray(saved) && saved.length) setMessages(saved.slice(-MAX_STORED_MESSAGES));
      else setMessages([{ role: 'livrinho', text: welcome(context), system: true }]);
    } catch (_) { setMessages([{ role: 'livrinho', text: welcome(context), system: true }]); }
  }, [memoryKey]);

  useEffect(() => {
    if (messages.length === 1 && messages[0]?.system && context) setMessages([{ role: 'livrinho', text: welcome(context), system: true }]);
  }, [context]);

  useEffect(() => {
    if (!messages.length) return;
    try { localStorage.setItem(memoryKey, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))); } catch (_) {}
  }, [messages, memoryKey]);

  useEffect(() => {
    if (!onEditor) { setIdleReady(false); setSelection(null); return; }
    const update = () => {
      lastTypeRef.current = Date.now(); setIdleReady(false);
      setSelection(readEditor().selection);
    };
    const textarea = document.querySelector('[data-tour="editor-texto"] textarea');
    textarea?.addEventListener('input', update);
    textarea?.addEventListener('keyup', update);
    textarea?.addEventListener('mouseup', update);
    const tick = setInterval(() => setIdleReady(Date.now() - lastTypeRef.current >= IDLE_MS), 30000);
    update();
    return () => {
      textarea?.removeEventListener('input', update);
      textarea?.removeEventListener('keyup', update);
      textarea?.removeEventListener('mouseup', update);
      clearInterval(tick);
    };
  }, [onEditor, location.pathname]);

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail || {};
      setNotice(detail.ok ? 'Alteracao aplicada no editor.' : (detail.error || 'Nao foi possivel aplicar a alteracao.'));
      setTimeout(() => setNotice(''), 3200);
    };
    window.addEventListener('novly:livrinho-edit-result', handler);
    return () => window.removeEventListener('novly:livrinho-edit-result', handler);
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, busy]);

  const ensureConsent = () => {
    if (localStorage.getItem('novly_gemini_consent') === '1') return true;
    const accepted = window.confirm('O Livrinho usa o Google Gemini. Sua pergunta e o contexto necessario do livro podem ser enviados ao Google para gerar a resposta. Deseja continuar?');
    if (accepted) localStorage.setItem('novly_gemini_consent', '1');
    return accepted;
  };

  const send = useCallback(async ({ prompt, label, actionTarget = null, temperature, maxOutputTokens }) => {
    if (!String(prompt || '').trim() || busy) return;
    if (!getGeminiKey()) {
      setOpen(true);
      setMessages((m) => [...m, { role: 'user', text: label || prompt }, { role: 'livrinho', text: 'Configure sua chave Gemini em Configuracoes para eu conseguir analisar o livro.' }]);
      return;
    }
    if (!ensureConsent()) return;

    const editor = readEditor();
    let contextText = buildContextText(context, editor.text, scope);
    if (chapterId && mode === 'canon' && String(label || prompt).length > 8) {
      try {
        const found = await api.livrinhoSearch(chapterId, String(label || prompt));
        if (found.matches?.length) {
          contextText += '\n\nPESQUISA RELEVANTE NO MANUSCRITO:\n' + found.matches.map((m) => `- ${m.title}: ${compactValue(m.excerpt, 950)}`).join('\n');
        }
      } catch (_) {}
    }
    const history = messages.filter((m) => !m.system).slice(-10);
    setOpen(true); setBusy(true); setIdleReady(false);
    setMessages((m) => [...m, { role: 'user', text: label || prompt }]);
    try {
      const reply = await askLivrinho({
        prompt,
        history,
        systemHint: systemPrompt(contextText, MODES[mode].label),
        temperature,
        maxOutputTokens,
      });
      setMessages((m) => [...m, { role: 'livrinho', text: reply, actionTarget }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'livrinho', text: err.message || 'Algo deu errado. Tente novamente.' }]);
    } finally { setBusy(false); lastTypeRef.current = Date.now(); }
  }, [busy, chapterId, context, messages, mode, scope]);

  function runAction(action) {
    const editor = readEditor();
    if (action.requiresSelection && !editor.selection) {
      setNotice('Selecione um trecho no editor primeiro.'); setTimeout(() => setNotice(''), 2800); return;
    }
    const replaceTarget = action.type === 'replace';
    const target = action.type ? {
      mode: action.type,
      chapterId,
      start: replaceTarget ? editor.selection.start : editor.caret,
      end: replaceTarget ? editor.selection.end : editor.caret,
      original: replaceTarget ? editor.selection.text : '',
      anchorBefore: replaceTarget ? '' : editor.text.slice(Math.max(0, editor.caret - 100), editor.caret),
    } : null;
    send({
      prompt: action.prompt({ editor: editor.text, selection: editor.selection }),
      label: action.label,
      actionTarget: target,
      temperature: action.type ? 0.62 : undefined,
      maxOutputTokens: action.type ? 1300 : undefined,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim(); if (!text) return;
    setInput(''); send({ prompt: text, label: text });
  }

  function applyMessage(message) {
    if (!message.actionTarget || !onEditor) return;
    window.dispatchEvent(new CustomEvent('novly:livrinho-edit', { detail: { ...message.actionTarget, text: cleanGeneratedText(message.text) } }));
  }

  function clearConversation() {
    if (!window.confirm('Limpar a conversa do Livrinho para este capitulo?')) return;
    setMessages([{ role: 'livrinho', text: welcome(context), system: true }]);
    localStorage.removeItem(memoryKey);
  }

  const currentMode = MODES[mode];

  return (
    <div className="livrinho-root" data-tour="livrinho">
      {notice && <div className="livrinho-notice">{notice}</div>}
      {open && (
        <section className="livrinho-panel" aria-label="Livrinho">
          <header className="livrinho-panel-head">
            <div className="livrinho-heading">
              <span className="livrinho-mini-book" aria-hidden="true" />
              <div>
                <strong>Livrinho</strong>
                <span>{context?.book?.title ? `${context.book.title} · ${context.chapter.title}` : 'assistente editorial do Novly'}</span>
              </div>
            </div>
            <div className="livrinho-head-actions">
              <button type="button" onClick={refreshContext} disabled={!chapterId || contextLoading} title="Atualizar contexto">↻</button>
              <button type="button" onClick={clearConversation} title="Limpar conversa">⌫</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </div>
          </header>

          <div className="livrinho-contextbar">
            <span className={`livrinho-context-dot ${contextError ? 'error' : contextLoading ? 'loading' : context ? 'ready' : ''}`} />
            <span>{contextError || (contextLoading ? 'Lendo o livro…' : context ? 'Canon conectado' : 'Abra um capítulo para conectar o canon')}</span>
            {onEditor && (
              <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Contexto enviado ao Livrinho">
                <option value="full">Capítulo + canon</option>
                <option value="chapter">Só capítulo</option>
              </select>
            )}
          </div>

          {selection && onEditor && (
            <div className="livrinho-selection">
              <span>Trecho selecionado</span>
              <p>“{compactValue(selection.text, 170)}”</p>
            </div>
          )}

          <nav className="livrinho-modes" aria-label="Modos do Livrinho">
            {Object.entries(MODES).map(([id, item]) => (
              <button key={id} type="button" className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>

          <div className="livrinho-messages" ref={listRef}>
            {messages.map((msg, i) => (
              <div key={`${i}-${msg.role}`} className={`livrinho-msg ${msg.role}`}>
                {msg.role === 'livrinho' && <span className="livrinho-msg-label">Livrinho</span>}
                <p>{msg.text}</p>
                {msg.role === 'livrinho' && !msg.system && (
                  <div className="livrinho-msg-actions">
                    {msg.actionTarget && onEditor && <button type="button" onClick={() => applyMessage(msg)}>{msg.actionTarget.mode === 'replace' ? 'Substituir seleção' : 'Inserir no editor'}</button>}
                    <button type="button" onClick={() => navigator.clipboard?.writeText(msg.text)}>Copiar</button>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="livrinho-msg livrinho"><span className="livrinho-msg-label">Livrinho</span><p className="livrinho-typing">consultando manuscrito e canon…</p></div>}
          </div>

          <div className="livrinho-quick">
            {currentMode.actions.map((action) => (
              <button key={action.id} type="button" disabled={busy || (action.requiresSelection && !selection)} onClick={() => runAction(action)} title={action.requiresSelection && !selection ? 'Selecione um trecho no editor' : ''}>
                {action.label}
              </button>
            ))}
          </div>

          <form className="livrinho-form" onSubmit={handleSubmit}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={currentMode.placeholder} disabled={busy} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar">↑</button>
          </form>
          <footer className="livrinho-footer">Enter envia · Shift+Enter quebra linha · IA nunca altera o manuscrito sem sua confirmação</footer>
        </section>
      )}

      <button type="button" className={`livrinho-fab${idleReady ? ' attention' : ''}${open ? ' open' : ''}`} onClick={() => { setOpen((o) => !o); setIdleReady(false); }} aria-label="Abrir Livrinho" title={idleReady ? 'Quer destravar a cena?' : 'Livrinho'}>
        <span className="livrinho-book" aria-hidden="true"><span className="livrinho-book-cover" /><span className="livrinho-book-pages" /></span>
        {idleReady && !open && <span className="livrinho-attention-dot" />}
      </button>
    </div>
  );
}
