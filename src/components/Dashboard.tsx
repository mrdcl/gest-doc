import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, LogOut, User, Search, RefreshCw, Users, Shield, Bell, Tag, Trash2, ChevronDown, Settings, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ClientList from './ClientList';
import EntityList from './EntityList';
import DocumentManager from './DocumentManager';
import DocumentSearch from './DocumentSearch';
import OCRReprocessor from './OCRReprocessor';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';
import TwoFactorAuth from './TwoFactorAuth';
import NotificationCenter from './NotificationCenter';
import TagManager from './TagManager';
import RecycleBin from './RecycleBin';
import { useNotifications } from '../hooks/useNotifications';

type ViewState =
  | { type: 'clients' }
  | { type: 'entities'; clientId: string }
  | { type: 'documents'; entityId: string; clientId: string }
  | { type: 'users' }
  | { type: 'audit' }
  | { type: 'tags' }
  | { type: 'recycle' };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [viewState, setViewState] = useState<ViewState>({ type: 'clients' });
  const [showSearch, setShowSearch] = useState(false);
  const [showOCRReprocessor, setShowOCRReprocessor] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { unreadCount } = useNotifications();

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

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNotifications(true)}
                className="relative flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Buscar en contenido de documentos"
              >
                <Search className="w-5 h-5" />
              </button>

              {(profile?.role === 'admin' || profile?.role === 'rc_abogados') && (
                <>
                  <button
                    onClick={() => setViewState({ type: 'tags' })}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Gestión de etiquetas"
                  >
                    <Tag className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewState({ type: 'recycle' })}
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Papelera de reciclaje"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}

              <div className="h-8 w-px bg-gray-300"></div>

              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-sm font-medium text-gray-900">
                        {profile?.full_name || user?.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getRoleName(profile?.role || 'user')}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {profile?.full_name || user?.email}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {user?.email}
                        </p>
                      </div>

                      {(profile?.role === 'admin' || profile?.role === 'rc_abogados') && (
                        <>
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setShow2FA(true);
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Lock className="w-4 h-4" />
                              Autenticación 2FA
                            </button>
                            <button
                              onClick={() => {
                                setViewState({ type: 'users' });
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Users className="w-4 h-4" />
                              Gestión de Usuarios
                            </button>
                            <button
                              onClick={() => {
                                setViewState({ type: 'audit' });
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <Shield className="w-4 h-4" />
                              Registro de Auditoría
                            </button>
                            <button
                              onClick={() => {
                                setShowOCRReprocessor(true);
                                setShowUserMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Reprocesar OCR
                            </button>
                          </div>
                          <div className="border-t border-gray-200"></div>
                        </>
                      )}

                      <div className="py-1">
                        <button
                          onClick={() => {
                            signOut();
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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

        {viewState.type === 'tags' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button
              onClick={() => setViewState({ type: 'clients' })}
              className="mb-6 p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center gap-2 text-gray-600"
            >
              ← Volver
            </button>
            <TagManager />
          </div>
        )}

        {viewState.type === 'recycle' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button
              onClick={() => setViewState({ type: 'clients' })}
              className="mb-6 p-2 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center gap-2 text-gray-600"
            >
              ← Volver
            </button>
            <RecycleBin />
          </div>
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

      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}
    </div>
  );
}
