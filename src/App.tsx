import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SessionDetailPage } from '@/pages/SessionDetailPage';
import { FormationsPage } from '@/pages/FormationsPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InscriptionPage } from '@/pages/InscriptionPage';
import { ConventionClientPage } from '@/pages/ConventionClientPage';
import { SuiviClientPage } from '@/pages/SuiviClientPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-nikita-gray"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nikita-pink" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            {/* Pages publiques */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/inscription/:token" element={<InscriptionPage />} />
            <Route path="/conventions/client/:token" element={<ConventionClientPage />} />
            <Route path="/suivi/:token" element={<SuiviClientPage />} />

            {/* Pages admin */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/formations" element={<FormationsPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
