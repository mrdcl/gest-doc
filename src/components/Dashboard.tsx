import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, LogOut, User, Search, RefreshCw, Users, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ClientList from './ClientList';
import EntityList from './EntityList';
import DocumentManager from './DocumentManager';
import DocumentSearch from './DocumentSearch';
import OCRReprocessor from './OCRReprocessor';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';
import TwoFactorAuth from './TwoFactorAuth';

type ViewState =
  | { type: 'clients' }
  | { type: 'entities'; clientId: string }
  | { type: 'documents'; entityId: string; clientId: string }
  | { type: 'users' }
  | { type: 'audit' };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [viewState, setViewState] = useState<ViewState>({ type: 'clients' });
  const [showSearch, setShowSearch] = useState(false);
  const [showOCRReprocessor, setShowOCRReprocessor] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'rc_abogados':
        return 'RC Abogados';
      case 'cliente':
        return 'Cliente';
      default:
        return 'Usuario';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gestión Documental Corporativa</h1>
                <p className="text-sm text-gray-500">Sistema por Cliente → Sociedad → Documentos</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Buscar en contenido de documentos"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Buscar contenido</span>
              </button>
              {(profile?.role === 'admin' || profile?.role === 'rc_abogados') && (
                <>
                  <button
                    onClick={() => setShowOCRReprocessor(true)}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Reprocesar documentos con OCR"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">OCR</span>
                  </button>
                  <button
                    onClick={() => setViewState({ type: 'users' })}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Administrar usuarios"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Usuarios</span>
                  </button>
                  <button
                    onClick={() => setViewState({ type: 'audit' })}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Registro de auditoría"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Auditoría</span>
                  </button>
                </>
              )}
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{profile?.full_name || user?.email}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {getRoleName(profile?.role || 'user')}
                </span>
              </div>
              <button
                onClick={() => setShow2FA(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Configurar 2FA"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">2FA</span>
              </button>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewState.type === 'clients' && (
          <ClientList
            onSelectClient={(clientId) => setViewState({ type: 'entities', clientId })}
            userRole={profile?.role || 'user'}
          />
        )}

        {viewState.type === 'entities' && (
          <EntityList
            clientId={viewState.clientId}
            onSelectEntity={(entityId) =>
              setViewState({ type: 'documents', entityId, clientId: viewState.clientId })
            }
            onBack={() => setViewState({ type: 'clients' })}
            userRole={profile?.role || 'user'}
          />
        )}

        {viewState.type === 'documents' && (
          <DocumentManager
            entityId={viewState.entityId}
            onBack={() =>
              setViewState({ type: 'entities', clientId: viewState.clientId })
            }
            userRole={profile?.role || 'user'}
          />
        )}

        {viewState.type === 'users' && (
          <UserManagement onBack={() => setViewState({ type: 'clients' })} />
        )}

        {viewState.type === 'audit' && (
          <AuditLog onBack={() => setViewState({ type: 'clients' })} />
        )}
      </main>

      {showSearch && (
        <DocumentSearch
          onClose={() => setShowSearch(false)}
          onDocumentSelect={(clientId, entityId) => {
            setViewState({ type: 'documents', entityId, clientId });
            setShowSearch(false);
          }}
        />
      )}

      {showOCRReprocessor && (
        <OCRReprocessor onClose={() => setShowOCRReprocessor(false)} />
      )}

      {show2FA && (
        <TwoFactorAuth onClose={() => setShow2FA(false)} />
      )}
    </div>
  );
}
