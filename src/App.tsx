import { AuthProvider, useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import posthog from 'posthog-js';
import { useEffect } from 'react';

// Simulación de consentimiento: reemplazar por lógica real si existe
function getTelemetryConsent() {
  return localStorage.getItem('telemetry_consent') === 'true';
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <Auth />;
}

function App() {
  useEffect(() => {
    if (getTelemetryConsent()) {
      posthog.init('TU_POSTHOG_API_KEY', {
        api_host: 'https://app.posthog.com',
        autocapture: false,
      });
    }
  }, []);
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
