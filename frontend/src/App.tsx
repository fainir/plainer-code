import { Routes, Route, Navigate } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { getMe } from './api/auth';
import Login from './pages/Login';
import Register from './pages/Register';
import DriveLayout from './pages/DriveLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getMe()
        .then(setUser)
        .catch(() => useAuthStore.getState().logout());
    }
  }, [isAuthenticated, setUser]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/drive/*"
        element={
          <ProtectedRoute>
            <DriveLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={isAuthenticated ? '/drive' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/drive' : '/login'} replace />} />
    </Routes>
  );
}
