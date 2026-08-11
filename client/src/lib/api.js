const API_ORIGIN = import.meta.env.PROD
  ? 'https://novly-3cox.onrender.com'
  : 'http://localhost:4001';

const BASE = `${API_ORIGIN}/api`;

export function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || 'Algo deu errado.');
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  library: () => request('/books'),
  book: (slug) => request(`/books/${slug}`),
  chapter: (slug, chapterId) => request(`/books/${slug}/chapters/${chapterId}`),
  saveProgress: (slug, chapterId, payload) =>
    request(`/books/${slug}/chapters/${chapterId}/progress`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeChapter: (slug, chapterId, payload) =>
    request(`/books/${slug}/chapters/${chapterId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  toggleChapterLike: (slug, chapterId) =>
    request(`/books/${slug}/chapters/${chapterId}/like`, { method: 'POST' }),
  toggleChapterFavorite: (slug, chapterId) =>
    request(`/books/${slug}/chapters/${chapterId}/favorite`, { method: 'POST' }),

  chapterComments: (chapterId) => request(`/comments/chapter/${chapterId}`),
  postComment: (chapterId, payload) =>
    request(`/comments/chapter/${chapterId}`, { method: 'POST', body: JSON.stringify(payload) }),
  resolveComment: (id) => request(`/comments/${id}/resolve`, { method: 'PATCH' }),
  pinComment: (id) => request(`/comments/${id}/pin`, { method: 'PATCH' }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  highlights: () => request('/highlights'),
  createHighlight: (payload) =>
    request('/highlights', { method: 'POST', body: JSON.stringify(payload) }),
  updateHighlightNote: (id, note) =>
    request(`/highlights/${id}/note`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  deleteHighlight: (id) => request(`/highlights/${id}`, { method: 'DELETE' }),

  homeSummary: () => request('/home/summary'),
  pingPresence: (location) =>
    request('/home/presence/ping', { method: 'POST', body: JSON.stringify({ location }) }),

  profile: (userId) => request(`/profile/${userId}`),
  updateMe: (payload) => request('/profile/me', { method: 'PATCH', body: JSON.stringify(payload) }),

  writerDashboard: () => request('/writer/dashboard'),
  writerHistory: (days) => request(`/writer/dashboard/history${days ? `?days=${days}` : ''}`),
  updateWriterGoals: (payload) =>
    request('/writer/dashboard/goals', { method: 'PATCH', body: JSON.stringify(payload) }),

  writerBooks: () => request('/writer/books'),
  createBook: (payload) =>
    request('/writer/books', { method: 'POST', body: JSON.stringify(payload) }),
  updateBook: (id, payload) =>
    request(`/writer/books/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  publishBook: (id) => request(`/writer/books/${id}/publish`, { method: 'POST' }),
  deleteBook: (id) => request(`/writer/books/${id}`, { method: 'DELETE' }),

  writerChapters: (bookId) => request(`/writer/books/${bookId}/chapters`),
  createChapter: (bookId, payload) =>
    request(`/writer/books/${bookId}/chapters`, { method: 'POST', body: JSON.stringify(payload) }),
  writerChapter: (chapterId) => request(`/writer/chapters/${chapterId}`),
  chapterLore: (chapterId) => request(`/writer/chapters/${chapterId}/lore`),
  saveChapter: (chapterId, payload) =>
    request(`/writer/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createSnapshot: (chapterId, label) =>
    request(`/writer/chapters/${chapterId}/snapshot`, { method: 'POST', body: JSON.stringify({ label }) }),
  chapterVersions: (chapterId) => request(`/writer/chapters/${chapterId}/versions`),
  chapterVersion: (chapterId, versionId) =>
    request(`/writer/chapters/${chapterId}/versions/${versionId}`),
  restoreVersion: (chapterId, versionId) =>
    request(`/writer/chapters/${chapterId}/versions/${versionId}/restore`, { method: 'POST' }),
  publishChapter: (chapterId) => request(`/writer/chapters/${chapterId}/publish`, { method: 'POST' }),
  unpublishChapter: (chapterId) => request(`/writer/chapters/${chapterId}/unpublish`, { method: 'POST' }),
  scheduleChapter: (chapterId, scheduledFor) =>
    request(`/writer/chapters/${chapterId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_for: scheduledFor }),
    }),
  deleteChapter: (chapterId) => request(`/writer/chapters/${chapterId}`, { method: 'DELETE' }),
  reorderChapter: (chapterId, direction) =>
    request(`/writer/chapters/${chapterId}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),
  endWritingSession: () => request('/writer/sessions/end', { method: 'POST' }),

  writerCharacters: () => request('/writer/characters'),
  writerCharacter: (id) => request(`/writer/characters/${id}`),
  createCharacter: (name) =>
    request('/writer/characters', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCharacter: (id, payload) =>
    request(`/writer/characters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCharacter: (id) => request(`/writer/characters/${id}`, { method: 'DELETE' }),
  linkCharacterBook: (id, bookId) =>
    request(`/writer/characters/${id}/books/${bookId}`, { method: 'POST' }),
  unlinkCharacterBook: (id, bookId) =>
    request(`/writer/characters/${id}/books/${bookId}`, { method: 'DELETE' }),
  linkCharacterChapter: (id, chapterId) =>
    request(`/writer/characters/${id}/chapters/${chapterId}`, { method: 'POST' }),
  unlinkCharacterChapter: (id, chapterId) =>
    request(`/writer/characters/${id}/chapters/${chapterId}`, { method: 'DELETE' }),

  writerPlaces: () => request('/writer/places'),
  writerPlace: (id) => request(`/writer/places/${id}`),
  createPlace: (name) =>
    request('/writer/places', { method: 'POST', body: JSON.stringify({ name }) }),
  updatePlace: (id, payload) =>
    request(`/writer/places/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePlace: (id) => request(`/writer/places/${id}`, { method: 'DELETE' }),
  linkPlaceBook: (id, bookId) =>
    request(`/writer/places/${id}/books/${bookId}`, { method: 'POST' }),
  unlinkPlaceBook: (id, bookId) =>
    request(`/writer/places/${id}/books/${bookId}`, { method: 'DELETE' }),
  linkPlaceChapter: (id, chapterId) =>
    request(`/writer/places/${id}/chapters/${chapterId}`, { method: 'POST' }),
  unlinkPlaceChapter: (id, chapterId) =>
    request(`/writer/places/${id}/chapters/${chapterId}`, { method: 'DELETE' }),
  createPlaceEvent: (id, payload) =>
    request(`/writer/places/${id}/events`, { method: 'POST', body: JSON.stringify(payload) }),
  deletePlaceEvent: (id, eventId) =>
    request(`/writer/places/${id}/events/${eventId}`, { method: 'DELETE' }),

  bookCharacters: (slug) => request(`/books/${slug}/characters`),
  bookPlaces: (slug) => request(`/books/${slug}/places`),
  bookObjects: (slug) => request(`/books/${slug}/objects`),
  bookTimeline: (slug) => request(`/books/${slug}/timeline`),

  writerObjects: () => request('/writer/objects'),
  writerObject: (id) => request(`/writer/objects/${id}`),
  createObject: (name) =>
    request('/writer/objects', { method: 'POST', body: JSON.stringify({ name }) }),
  updateObject: (id, payload) =>
    request(`/writer/objects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteObject: (id) => request(`/writer/objects/${id}`, { method: 'DELETE' }),
  linkObjectBook: (id, bookId) =>
    request(`/writer/objects/${id}/books/${bookId}`, { method: 'POST' }),
  unlinkObjectBook: (id, bookId) =>
    request(`/writer/objects/${id}/books/${bookId}`, { method: 'DELETE' }),
  linkObjectChapter: (id, chapterId) =>
    request(`/writer/objects/${id}/chapters/${chapterId}`, { method: 'POST' }),
  unlinkObjectChapter: (id, chapterId) =>
    request(`/writer/objects/${id}/chapters/${chapterId}`, { method: 'DELETE' }),

  writerTimeline: (bookId) => request(`/writer/books/${bookId}/timeline`),
  createTimelineEvent: (bookId, payload) =>
    request(`/writer/books/${bookId}/timeline`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTimelineEvent: (id, payload) =>
    request(`/writer/timeline/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTimelineEvent: (id) => request(`/writer/timeline/${id}`, { method: 'DELETE' }),
  reorderTimelineEvent: (id, direction) =>
    request(`/writer/timeline/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),

  writerNotes: () => request('/writer/notes'),
  createNote: (payload) =>
    request('/writer/notes', { method: 'POST', body: JSON.stringify(payload) }),
  updateNote: (id, payload) =>
    request(`/writer/notes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteNote: (id) => request(`/writer/notes/${id}`, { method: 'DELETE' }),

  availableNote: () => request('/notes/available'),
  markNoteFound: (id) => request(`/notes/${id}/found`, { method: 'POST' }),

  writerKanban: (bookId) => request(`/writer/books/${bookId}/kanban`),
  createKanbanCard: (bookId, payload) =>
    request(`/writer/books/${bookId}/kanban`, { method: 'POST', body: JSON.stringify(payload) }),
  updateKanbanCard: (id, payload) =>
    request(`/writer/kanban/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  moveKanbanCard: (id, status) =>
    request(`/writer/kanban/${id}/move`, { method: 'POST', body: JSON.stringify({ status }) }),
  deleteKanbanCard: (id) => request(`/writer/kanban/${id}`, { method: 'DELETE' }),

  chapterScenes: (chapterId) => request(`/writer/chapters/${chapterId}/scenes`),
  createScene: (chapterId, payload) =>
    request(`/writer/chapters/${chapterId}/scenes`, { method: 'POST', body: JSON.stringify(payload) }),
  updateScene: (id, payload) =>
    request(`/writer/scenes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteScene: (id) => request(`/writer/scenes/${id}`, { method: 'DELETE' }),
  reorderScene: (id, direction) =>
    request(`/writer/scenes/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) }),

  editorPreferences: () => request('/writer/editor-preferences'),
  updateEditorPreferences: (payload) =>
    request('/writer/editor-preferences', { method: 'PATCH', body: JSON.stringify(payload) }),

  changeEmail: (newEmail, currentPassword) =>
    request('/settings/email', {
      method: 'PATCH',
      body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
    }),
  changePassword: (newPassword, currentPassword) =>
    request('/settings/password', {
      method: 'PATCH',
      body: JSON.stringify({ new_password: newPassword, current_password: currentPassword }),
    }),
  updateBackground: (backgroundType, backgroundValue) =>
    request('/settings/background', {
      method: 'PATCH',
      body: JSON.stringify({ background_type: backgroundType, background_value: backgroundValue }),
    }),


  uploadBackgroundImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/uploads/background-image`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Falha ao enviar imagem.');
    return data;
  },

  uploadCharacterPhoto: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/uploads/character-photo`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Falha ao enviar a foto.');
    return data;
  },

  uploadBookCover: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/uploads/book-cover`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Falha ao enviar a capa.');
    return data;
  },

  exportBook: (id) =>
    request(`/writer/books/${id}/export`),

  importBook: (payload) =>
    request('/writer/books/import', { method: 'POST', body: JSON.stringify(payload) }),

  checkGrammar: (text) =>
    request('/grammar/check', { method: 'POST', body: JSON.stringify({ text }) }),
};
