import { Routes, Route, Navigate } from 'react-router';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { getMe } from './api/auth';
import { identify, reset } from './lib/analytics';
import Login from './pages/Login';
import Register from './pages/Register';
import DriveLayout from './pages/DriveLayout';
import LandingPage from './pages/LandingPage';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Cookies from './pages/Cookies';
import AcceptableUse from './pages/AcceptableUse';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function ProtectedDrive() {
  return (
    <ProtectedRoute>
      <DriveLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  const { isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getMe()
        .then((u) => {
          setUser(u);
          if (u) identify(String(u.id), { $email: u.email, $name: u.display_name });
        })
        .catch(() => {
          reset();
          useAuthStore.getState().logout();
        });
    } else {
      reset();
    }
  }, [isAuthenticated, setUser]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/private" element={<ProtectedDrive />} />
      <Route path="/shared" element={<ProtectedDrive />} />
      <Route path="/folder/:folderId" element={<ProtectedDrive />} />
      <Route path="/file/:fileId" element={<ProtectedDrive />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/acceptable-use" element={<AcceptableUse />} />
      <Route path="/" element={isAuthenticated ? <Navigate to="/private" replace /> : <LandingPage />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/private' : '/'} replace />} />
    </Routes>
  );
}
