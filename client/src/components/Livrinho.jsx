import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { askLivrinho, getGeminiKey } from '../lib/gemini';
import './Livrinho.css';

const IDLE_MS = 3 * 60 * 1000;
const QUICK = [
  { id: 'continuar', label: 'Continuar o texto', build: (ctx) => `Continue este trecho de forma natural, no mesmo tom:\n\n${ctx.slice(-2500) || '(capitulo ainda vazio)'}` },
  { id: 'dialogo', label: 'Sugerir dialogo', build: (ctx) => `Sugira 4 a 6 falas de dialogo que poderiam vir a seguir, com indicacao breve de quem fala:\n\n${ctx.slice(-2000) || '(sem contexto)'}` },
  { id: 'bloqueio', label: 'Estou travado', build: (ctx) => `O escritor esta com bloqueio criativo. Ofereca 3 caminhos curtos e concretos para retomar a cena, com base neste texto:\n\n${ctx.slice(-2000) || '(ainda nao escreveu nada neste capitulo)'}` },
  { id: 'cena', label: 'Ideia de cena', build: (ctx) => `Proponha uma cena curta (objetivo, conflito, detalhe sensorial) que encaixe depois deste trecho:\n\n${ctx.slice(-2000) || '(comece do zero com uma ideia forte)'}` },
  { id: 'tom', label: 'Ajustar tom', build: (ctx) => `Comente o tom deste trecho e sugira 2 ajustes sutis sem reescrever tudo:\n\n${ctx.slice(-2000) || '(cole ou escreva algo no editor primeiro)'}` },
  { id: 'nome', label: 'Nome / detalhe', build: () => 'Sugira 5 nomes de personagem secundario e 3 detalhes de ambiente memoraveis para uma cena intima.' },
];

function readEditorContext() {
  const wrap = document.querySelector('[data-tour="editor-texto"]');
  if (!wrap) return '';
  const ta = wrap.tagName === 'TEXTAREA' ? wrap : wrap.querySelector('textarea');
  if (ta) return ta.value || '';
  return wrap.value || wrap.textContent || '';
}

export default function Livrinho() {
  const location = useLocation();
  const onEditor = location.pathname.startsWith('/escritor/capitulos/');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'livrinho',
      text: 'Oi. Eu sou o Livrinho. Posso continuar uma cena, soltar dialogo ou te cutucar quando o silencio durar demais.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [idleHint, setIdleHint] = useState(false);
  const lastTypeRef = useRef(Date.now());
  const listRef = useRef(null);

  useEffect(() => {
    if (!onEditor) {
      setIdleHint(false);
      return;
    }

    function markActivity() {
      lastTypeRef.current = Date.now();
      setIdleHint(false);
    }

    const el = document.querySelector('[data-tour="editor-texto"] textarea, [data-tour="editor-texto"]');
    if (el) {
      el.addEventListener('input', markActivity);
      el.addEventListener('keydown', markActivity);
    }

    const tick = setInterval(() => {
      if (Date.now() - lastTypeRef.current >= IDLE_MS) {
        setIdleHint(true);
        setBounce(true);
        setTimeout(() => setBounce(false), 1200);
      }
    }, 15000);

    return () => {
      if (el) {
        el.removeEventListener('input', markActivity);
        el.removeEventListener('keydown', markActivity);
      }
      clearInterval(tick);
    };
  }, [onEditor, location.pathname]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = useCallback(async (promptText, label) => {
    if (!promptText.trim() || busy) return;
    if (!getGeminiKey()) {
      setMessages((m) => [
        ...m,
        { role: 'user', text: label || promptText },
        {
          role: 'livrinho',
          text: 'Ainda nao tenho chave Gemini. Vai em Configuracoes, cola sua API key e volta aqui. Eu espero.',
        },
      ]);
      setOpen(true);
      return;
    }

    if (localStorage.getItem('novly_gemini_consent') !== '1') {
      const accepted = window.confirm(
        'O Livrinho usa o Google Gemini. O prompt e, quando aplicavel, trechos do capitulo serao enviados ao Google para gerar a resposta. Deseja continuar?'
      );
      if (!accepted) return;
      localStorage.setItem('novly_gemini_consent', '1');
    }

    setOpen(true);
    setMessages((m) => [...m, { role: 'user', text: label || promptText }]);
    setBusy(true);
    try {
      const reply = await askLivrinho({ prompt: promptText });
      setMessages((m) => [...m, { role: 'livrinho', text: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'livrinho', text: err.message || 'Algo deu errado na minha pagina. Tenta de novo?' },
      ]);
    } finally {
      setBusy(false);
      setIdleHint(false);
      lastTypeRef.current = Date.now();
    }
  }, [busy]);

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    send(text, text);
  }

  function handleQuick(action) {
    const ctx = readEditorContext();
    send(action.build(ctx), action.label);
  }

  function handleIdleHelp() {
    setIdleHint(false);
    const ctx = readEditorContext();
    send(
      `O escritor esta parado ha um tempo no editor. Com gentileza, ofereca ajuda curta e 2 perguntas que destravem a proxima frase. Contexto:\n\n${ctx.slice(-1500) || '(pagina em branco)'}`,
      'Me ajuda? Estou parado.'
    );
  }

  return (
    <div className="livrinho-root" data-tour="livrinho">
      {idleHint && onEditor && !open && (
        <div className="livrinho-idle-bubble">
          <p>Psiu... a pagina ficou quieta. Quer uma empurradinha?</p>
          <button type="button" onClick={handleIdleHelp}>
            Sim, Livrinho
          </button>
          <button type="button" className="ghost" onClick={() => setIdleHint(false)}>
            Ainda nao
          </button>
        </div>
      )}

      {open && (
        <div className="livrinho-panel">
          <div className="livrinho-panel-head">
            <div>
              <strong>Livrinho</strong>
              <span>companheiro de escrita</span>
            </div>
            <button type="button" className="livrinho-panel-close" onClick={() => setOpen(false)} aria-label="Fechar">
              ×
            </button>
          </div>

          <div className="livrinho-messages" ref={listRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`livrinho-msg ${msg.role}`}>
                {msg.role === 'livrinho' && <span className="livrinho-msg-label">Livrinho</span>}
                <p>{msg.text}</p>
              </div>
            ))}
            {busy && (
              <div className="livrinho-msg livrinho">
                <span className="livrinho-msg-label">Livrinho</span>
                <p className="livrinho-typing">folheando ideias...</p>
              </div>
            )}
          </div>

          <div className="livrinho-quick">
            {QUICK.map((q) => (
              <button key={q.id} type="button" disabled={busy} onClick={() => handleQuick(q)}>
                {q.label}
              </button>
            ))}
          </div>

          <form className="livrinho-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte ao Livrinho..."
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`livrinho-fab${bounce ? ' bounce' : ''}${open ? ' open' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          setIdleHint(false);
        }}
        aria-label="Abrir Livrinho"
        title="Livrinho"
      >
        <span className="livrinho-book" aria-hidden="true">
          <span className="livrinho-book-cover" />
          <span className="livrinho-book-pages" />
        </span>
      </button>
    </div>
  );
}
