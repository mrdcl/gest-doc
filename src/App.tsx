import { AuthProvider, useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TelemetryConsent from './components/TelemetryConsent';
import { useEffect } from 'react';
import { initializeTelemetry, trackPageView } from './lib/telemetry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();

  // Track page views when user navigates
  useEffect(() => {
    if (user) {
      trackPageView('Dashboard');
    } else if (!loading) {
      trackPageView('Login');
    }
  }, [user, loading]);

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
    // Initialize telemetry on app load (respects user consent)
    initializeTelemetry();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <TelemetryConsent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
