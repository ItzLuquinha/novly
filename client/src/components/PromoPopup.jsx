import { useEffect, useState } from 'react';
import './PromoPopup.css';

const SITE = 'https://novlyx-cljwulfwu-piggy7.vercel.app/';
const DISMISS_KEY = 'novly_promo_never';
const LAST_KEY = 'novly_promo_last';
const HOUR_MS = 60 * 60 * 1000;

export default function PromoPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    function maybeShow() {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const last = Number(localStorage.getItem(LAST_KEY) || 0);
      if (Date.now() - last >= HOUR_MS) {
        setOpen(true);
        localStorage.setItem(LAST_KEY, String(Date.now()));
      }
    }

    maybeShow();
    const id = setInterval(maybeShow, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function close() {
    setOpen(false);
  }

  function neverAgain() {
    localStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="promo-overlay" role="dialog" aria-labelledby="promo-title">
      <div className="promo-card">
        <button type="button" className="promo-close" onClick={close} aria-label="Fechar">
          ×
        </button>
        <p className="promo-eyebrow">Um convite</p>
        <h2 id="promo-title" className="promo-title">
          Dá uma olhada no outro Novly
        </h2>
        <p className="promo-body">
          Tem uma versão experimental em outro endereço. Se quiser conferir, o link está aqui.
        </p>
        <a className="promo-link" href={SITE} target="_blank" rel="noopener noreferrer">
          Abrir novlyx
        </a>
        <div className="promo-actions">
          <button type="button" className="promo-btn ghost" onClick={close}>
            Depois
          </button>
          <button type="button" className="promo-btn" onClick={neverAgain}>
            Parar de aparecer
          </button>
        </div>
      </div>
    </div>
  );
}
