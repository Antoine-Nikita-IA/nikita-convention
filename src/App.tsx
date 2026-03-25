import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ApporteurDashboardPage } from '@/pages/ApporteurDashboardPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { SessionDetailPage } from '@/pages/SessionDetailPage';
import { FormationsPage } from '@/pages/FormationsPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InscriptionPage } from '@/pages/InscriptionPage';
import { ConventionClientPage } from '@/pages/ConventionClientPage';
import { SuiviClientPage } from '@/pages/SuiviClientPage';
import { DemandeFormationPage } from '@/pages/DemandeFormationPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-nikita-gray"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nikita-pink" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // Block unvalidated users
  if (!user.is_validated) return (
    <div className="min-h-screen flex items-center justify-center bg-nikita-gray px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⏳</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Compte en attente</h2>
        <p className="text-sm text-gray-600 mb-4">
          Votre compte a bien été créé mais il est en attente de validation par un administrateur.
          Vous serez notifié dès que votre accès sera activé.
        </p>
        <button onClick={() => { /* logout handled in context */ }} className="text-sm text-nikita-pink hover:underline">
          Retour
        </button>
      </div>
    </div>
  );
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SmartDashboard() {
  const { user } = useAuth();
  if (user?.role === 'apporteur_affaire') return <ApporteurDashboardPage />;
  return <DashboardPage />;
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
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/demande/:formationId" element={<DemandeFormationPage />} />
            <Route path="/inscription/:token" element={<InscriptionPage />} />
            <Route path="/conventions/client/:token" element={<ConventionClientPage />} />
            <Route path="/suivi/:token" element={<SuiviClientPage />} />

            {/* Pages protégées */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<SmartDashboard />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/sessions/:id" element={<SessionDetailPage />} />
              <Route path="/formations" element={<AdminRoute><FormationsPage /></AdminRoute>} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/utilisateurs" element={<AdminRoute><UsersPage /></AdminRoute>} />
              <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
