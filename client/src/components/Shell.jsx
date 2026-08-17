import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { usePresence } from '../hooks/usePresence.js';
import { useResolvedBackground } from '../hooks/useResolvedBackground.js';
import { api } from '../lib/api';
import { useEffect, useState, useRef } from 'react';
import HiddenNote from './HiddenNote.jsx';
import AmbientSounds from './AmbientSounds.jsx';
import GuidedTour from './GuidedTour.jsx';
import PromoPopup from './PromoPopup.jsx';
import Livrinho from './Livrinho.jsx';
import './Shell.css';

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [otherPresence, setOtherPresence] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const { style: backgroundStyle, videoUrl: bgVideoUrl } = useResolvedBackground(user);
  const tourReplayRef = useRef(null);

  usePresence('navegando');

  useEffect(() => {
    let mounted = true;
    function poll() {
      api.presenceStatus().then((data) => {
        if (mounted) setOtherPresence(data.other_presence);
      }).catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/entrar');
  }

  const links = [
    { to: '/', label: 'Inicio', tour: 'nav-inicio' },
    { to: '/biblioteca', label: 'Biblioteca', tour: 'nav-biblioteca' },
    { to: '/favoritos', label: 'Favoritos', tour: 'nav-favoritos' },
  ];

  if (user?.role === 'escritor') {
    links.push({ to: '/escritor', label: 'Escrever', tour: 'nav-escrever' });
    links.push({ to: '/escritor/personagens', label: 'Personagens', tour: 'nav-personagens' });
    links.push({ to: '/escritor/lugares', label: 'Lugares', tour: 'nav-lugares' });
    links.push({ to: '/escritor/objetos', label: 'Objetos', tour: 'nav-objetos' });
    links.push({ to: '/escritor/onde-se-localiza', label: 'Onde se localiza', tour: 'nav-localiza' });
    links.push({ to: '/escritor/bilhetes', label: 'Bilhetes', tour: 'nav-bilhetes' });
  }

  links.push({ to: '/configuracoes', label: 'Configuracoes', tour: 'nav-configuracoes' });

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <header className="shell-mobile-bar">
        <div className="shell-mark" data-tour="nav-marca">Novly</div>
        <button
          type="button"
          className="shell-menu-btn"
          aria-label={navOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {navOpen && <div className="shell-nav-backdrop" onClick={() => setNavOpen(false)} />}

      <nav className={`shell-nav${navOpen ? ' open' : ''}`}>
        <div className="shell-mark shell-mark-desktop" data-tour="nav-marca">Novly</div>
        <div className="shell-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              data-tour={link.tour}
              className={({ isActive }) => `shell-link${isActive ? ' active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        {otherPresence?.online && (
          <div className="shell-presence" data-tour="nav-presenca">
            <span className="shell-presence-dot" />
            {otherPresence.role === 'escritor' ? 'Ele esta por aqui agora' : 'Ela esta por aqui agora'}
          </div>
        )}

        <div className="shell-user" data-tour="nav-conta">
          <div className="shell-username">{user?.username}</div>
          <div className="shell-role">{user?.role === 'escritor' ? 'Escritor' : 'Leitora'}</div>
          <button className="shell-tour-replay" onClick={() => { tourReplayRef.current?.(); setNavOpen(false); }}>
            Ver tour novamente
          </button>
          <button className="shell-logout" onClick={handleLogout}>Sair</button>
          <div className="shell-legal">
            <Link to="/termos" onClick={() => setNavOpen(false)}>Termos</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/privacidade" onClick={() => setNavOpen(false)}>Privacidade</Link>
          </div>
        </div>
      </nav>
      <div className="shell-main-wrap">
        <div className="shell-background" aria-hidden="true">
          {bgVideoUrl && (
            <video
              className="shell-bg-video"
              src={bgVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          )}
          <div className="shell-bg-surface" style={backgroundStyle} />
        </div>
        <main className="shell-main">
          {children}
        </main>
      </div>
      <HiddenNote />
      <AmbientSounds />
      <GuidedTour replayTriggerRef={tourReplayRef} />
      <PromoPopup />
      {user?.role === 'escritor' && <Livrinho />}
    </div>
  );
}
