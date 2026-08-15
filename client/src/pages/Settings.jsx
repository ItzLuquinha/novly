import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { api, mediaUrl } from '../lib/api';
import { BACKGROUND_PRESETS } from '../lib/backgroundPresets.js';
import { getGeminiKey, setGeminiKey } from '../lib/gemini';
import './Settings.css';

export default function Settings() {
  const { user, refreshUser } = useAuth();

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [bgTab, setBgTab] = useState('preset');
  const [urlValue, setUrlValue] = useState('');
  const [bgMsg, setBgMsg] = useState(null);
  const [bgBusy, setBgBusy] = useState(false);

  const [geminiKey, setGeminiKeyState] = useState(() => getGeminiKey());
  const [geminiMsg, setGeminiMsg] = useState(null);

  function handleGeminiSave(e) {
    e.preventDefault();
    setGeminiKey(geminiKey);
    setGeminiMsg({ type: 'success', text: geminiKey.trim() ? 'Chave do Livrinho salva neste navegador.' : 'Chave removida.' });
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailBusy(true);
    try {
      await api.changeEmail(newEmail.trim(), emailPassword);
      setEmailMsg({ type: 'success', text: 'Email atualizado.' });
      setNewEmail('');
      setEmailPassword('');
      await refreshUser();
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordBusy(true);
    try {
      await api.changePassword(newPassword, currentPassword);
      setPasswordMsg({ type: 'success', text: 'Senha atualizada.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function applyBackground(type, value) {
    setBgMsg(null);
    setBgBusy(true);
    try {
      await api.updateBackground(type, value);
      await refreshUser();
      setBgMsg({ type: 'success', text: 'Fundo atualizado.' });
    } catch (err) {
      setBgMsg({ type: 'error', text: err.message });
    } finally {
      setBgBusy(false);
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgMsg(null);
    setBgBusy(true);
    try {
      const res = await api.uploadBackgroundImage(file);
      await applyBackground('upload', res.url);
    } catch (err) {
      setBgMsg({ type: 'error', text: err.message });
      setBgBusy(false);
    }
  }

  async function handleVideoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = file.type === 'video/mp4' || file.type === 'video/webm' || /\.(mp4|webm)$/i.test(file.name);
    if (!okType) {
      setBgMsg({ type: 'error', text: 'Use um arquivo MP4 ou WebM.' });
      e.target.value = '';
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setBgMsg({ type: 'error', text: 'Video muito grande. Maximo: 40MB.' });
      e.target.value = '';
      return;
    }
    setBgMsg(null);
    setBgBusy(true);
    try {
      const res = await api.uploadBackgroundVideo(file);
      await applyBackground('video', res.url);
    } catch (err) {
      setBgMsg({ type: 'error', text: err.message });
      setBgBusy(false);
    }
    e.target.value = '';
  }

  async function handleVideoUrlSubmit(e) {
    e.preventDefault();
    const value = urlValue.trim();
    if (!value) return;
    const lower = value.toLowerCase().split('?')[0];
    if (!lower.endsWith('.mp4') && !lower.endsWith('.webm')) {
      setBgMsg({ type: 'error', text: 'O link precisa terminar em .mp4 ou .webm.' });
      return;
    }
    await applyBackground('video', value);
  }

  async function handleUrlSubmit(e) {
    e.preventDefault();
    if (!urlValue.trim()) return;
    await applyBackground('url', urlValue.trim());
  }

  const currentPreviewStyle = (() => {
    if (!user) return {};
    if (user.background_type === 'preset') {
      const preset = BACKGROUND_PRESETS.find((p) => p.key === user.background_value);
      return preset ? { background: preset.style } : {};
    }
    if (user.background_type === 'upload' || user.background_type === 'url') {
      return { backgroundImage: `url(${user.background_value})` };
    }
    if (user.background_type === 'video') {
      return { background: 'linear-gradient(135deg, #1a1528, #0c0b12)' };
    }
    return {};
  })();

  return (
    <div className="settings-page">
      <h1 className="settings-title">Configuracoes</h1>

      <div className="settings-section">
        <h2 className="settings-section-heading">Email</h2>
        <p className="settings-section-subtitle">Email atual: {user?.email}</p>
        <form onSubmit={handleEmailSubmit}>
          <div className="settings-field">
            <label htmlFor="new-email">Novo email</label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="settings-field">
            <label htmlFor="email-password">Senha atual</label>
            <input
              id="email-password"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
            />
          </div>
          <button className="settings-submit-btn" type="submit" disabled={emailBusy}>
            {emailBusy ? 'Salvando...' : 'Atualizar email'}
          </button>
          {emailMsg && <p className={`settings-message ${emailMsg.type}`}>{emailMsg.text}</p>}
        </form>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-heading">Senha</h2>
        <p className="settings-section-subtitle">Use pelo menos 8 caracteres.</p>
        <form onSubmit={handlePasswordSubmit}>
          <div className="settings-field">
            <label htmlFor="current-password">Senha atual</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="settings-field">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <button className="settings-submit-btn" type="submit" disabled={passwordBusy}>
            {passwordBusy ? 'Salvando...' : 'Atualizar senha'}
          </button>
          {passwordMsg && <p className={`settings-message ${passwordMsg.type}`}>{passwordMsg.text}</p>}
        </form>
      </div>

      <div className="settings-section" style={{ border: 'none', paddingBottom: 0 }}>
        <h2 className="settings-section-heading">Fundo</h2>
        <p className="settings-section-subtitle">
          Escolha um tema pronto, envie uma foto, um wallpaper ao vivo (MP4), ou use um link.
        </p>

        <div className="settings-bg-tabs">
          <button
            className={`settings-bg-tab${bgTab === 'preset' ? ' active' : ''}`}
            onClick={() => setBgTab('preset')}
          >
            Temas
          </button>
          <button
            className={`settings-bg-tab${bgTab === 'upload' ? ' active' : ''}`}
            onClick={() => setBgTab('upload')}
          >
            Da galeria
          </button>
          <button
            className={`settings-bg-tab${bgTab === 'url' ? ' active' : ''}`}
            onClick={() => setBgTab('url')}
          >
            Link de foto
          </button>
          <button
            className={`settings-bg-tab${bgTab === 'live' ? ' active' : ''}`}
            onClick={() => setBgTab('live')}
          >
            Wallpaper vivo
          </button>
        </div>

        {bgTab === 'preset' && (
          <div className="settings-preset-grid">
            <div
              className={`settings-preset-swatch${user?.background_type === 'default' ? ' active' : ''}`}
              style={{ background: '#0d0a08' }}
              onClick={() => applyBackground('default', '')}
            >
              <span className="settings-preset-swatch-label">Padrao (muda com o horario)</span>
            </div>
            {BACKGROUND_PRESETS.map((preset) => (
              <div
                key={preset.key}
                className={`settings-preset-swatch${
                  user?.background_type === 'preset' && user?.background_value === preset.key ? ' active' : ''
                }`}
                style={{ background: preset.style }}
                onClick={() => applyBackground('preset', preset.key)}
              >
                <span className="settings-preset-swatch-label">{preset.label}</span>
              </div>
            ))}
          </div>
        )}

        {bgTab === 'upload' && (
          <>
            <label className="settings-upload-zone">
              <input type="file" accept="image/*" onChange={handleFileSelect} disabled={bgBusy} />
              <p className="settings-upload-hint">
                {bgBusy ? 'Enviando...' : 'Clique para escolher uma foto da sua galeria'}
              </p>
            </label>
            <p className="settings-size-hint">
              Funciona melhor com fotos horizontais (formato paisagem), pelo menos 1600x900px.
              A imagem preenche toda a tela e e cortada para se encaixar, entao evite deixar
              o assunto principal muito perto das bordas. Tamanho maximo: 8MB.
            </p>
          </>
        )}

        {bgTab === 'url' && (
          <>
            <form className="settings-url-row" onSubmit={handleUrlSubmit}>
              <input
                type="url"
                placeholder="https://..."
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                required
              />
              <button className="settings-submit-btn" type="submit" disabled={bgBusy}>
                {bgBusy ? 'Salvando...' : 'Usar este link'}
              </button>
            </form>
            <p className="settings-size-hint">
              Funciona melhor com fotos horizontais (formato paisagem), pelo menos 1600x900px.
              A imagem preenche toda a tela e e cortada para se encaixar, entao evite links
              onde o assunto principal fica muito perto das bordas.
            </p>
          </>
        )}

        {bgMsg && <p className={`settings-message ${bgMsg.type}`}>{bgMsg.text}</p>}

        {user?.background_type && user.background_type !== 'default' && (
          <div className="settings-bg-preview" style={currentPreviewStyle}>
            <span className="settings-bg-preview-label">
              Fundo atual{user.background_type === 'video' ? ' (video ao vivo)' : ''}
            </span>
            {user.background_type === 'video' && user.background_value && (
              <video
                className="settings-bg-video-preview"
                src={mediaUrl(user.background_value)}
                muted
                loop
                autoPlay
                playsInline
              />
            )}
          </div>
        )}
      </div>

      {user?.role === 'escritor' && (
        <div className="settings-section" data-tour="livrinho-api">
          <h2 className="settings-section-heading">Livrinho (IA)</h2>
          <p className="settings-section-subtitle">
            Cole sua API key do Google Gemini. Ela fica so neste navegador (localStorage)
            e e usada pelo Livrinho para sugerir texto, dialogo e ideias de cena.
          </p>
          <form onSubmit={handleGeminiSave}>
            <div className="settings-field">
              <label htmlFor="gemini-key">API key Gemini</label>
              <input
                id="gemini-key"
                type="password"
                autoComplete="off"
                value={geminiKey}
                onChange={(e) => setGeminiKeyState(e.target.value)}
                placeholder="AIza..."
              />
            </div>
            <button className="settings-submit-btn" type="submit">
              Salvar chave
            </button>
            {geminiMsg && <p className={`settings-message ${geminiMsg.type}`}>{geminiMsg.text}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
