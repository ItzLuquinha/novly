import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Library from './pages/Library.jsx';
import Book from './pages/Book.jsx';
import Reader from './pages/Reader.jsx';
import Favorites from './pages/Favorites.jsx';
import WriterDashboard from './pages/WriterDashboard.jsx';
import WriterBook from './pages/WriterBook.jsx';
import Editor from './pages/Editor.jsx';
import WriterCharacters from './pages/WriterCharacters.jsx';
import WriterCharacterDetail from './pages/WriterCharacterDetail.jsx';
import WriterPlaces from './pages/WriterPlaces.jsx';
import WriterPlaceDetail from './pages/WriterPlaceDetail.jsx';
import WriterObjects from './pages/WriterObjects.jsx';
import WriterObjectDetail from './pages/WriterObjectDetail.jsx';
import WriterTimeline from './pages/WriterTimeline.jsx';
import WriterNotes from './pages/WriterNotes.jsx';
import Kanban from './pages/Kanban.jsx';
import BookCharacters from './pages/BookCharacters.jsx';
import BookPlaces from './pages/BookPlaces.jsx';
import BookObjects from './pages/BookObjects.jsx';
import BookTimeline from './pages/BookTimeline.jsx';
import Settings from './pages/Settings.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireWriter from './components/RequireWriter.jsx';
import Shell from './components/Shell.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/biblioteca" element={<Library />} />
                <Route path="/biblioteca/:slug" element={<Book />} />
                <Route path="/biblioteca/:slug/personagens" element={<BookCharacters />} />
                <Route path="/biblioteca/:slug/lugares" element={<BookPlaces />} />
                <Route path="/biblioteca/:slug/objetos" element={<BookObjects />} />
                <Route path="/biblioteca/:slug/linha-do-tempo" element={<BookTimeline />} />
                <Route path="/biblioteca/:slug/:chapterId" element={<Reader />} />
                <Route path="/favoritos" element={<Favorites />} />
                <Route path="/escritor" element={<RequireWriter><WriterDashboard /></RequireWriter>} />
                <Route path="/escritor/livros/:bookId" element={<RequireWriter><WriterBook /></RequireWriter>} />
                <Route path="/escritor/livros/:bookId/linha-do-tempo" element={<RequireWriter><WriterTimeline /></RequireWriter>} />
                <Route path="/escritor/livros/:bookId/quadro" element={<RequireWriter><Kanban /></RequireWriter>} />
                <Route path="/escritor/capitulos/:chapterId" element={<RequireWriter><Editor /></RequireWriter>} />
                <Route path="/escritor/personagens" element={<RequireWriter><WriterCharacters /></RequireWriter>} />
                <Route path="/escritor/personagens/:id" element={<RequireWriter><WriterCharacterDetail /></RequireWriter>} />
                <Route path="/escritor/lugares" element={<RequireWriter><WriterPlaces /></RequireWriter>} />
                <Route path="/escritor/lugares/:id" element={<RequireWriter><WriterPlaceDetail /></RequireWriter>} />
                <Route path="/escritor/objetos" element={<RequireWriter><WriterObjects /></RequireWriter>} />
                <Route path="/escritor/objetos/:id" element={<RequireWriter><WriterObjectDetail /></RequireWriter>} />
                <Route path="/escritor/bilhetes" element={<RequireWriter><WriterNotes /></RequireWriter>} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="/termos" element={<Terms />} />
                <Route path="/privacidade" element={<Privacy />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

