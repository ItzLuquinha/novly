import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function RequireWriter({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user?.role !== 'escritor') return <Navigate to="/" replace />;

  return children;
}
