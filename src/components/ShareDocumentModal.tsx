import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Share2, AlertTriangle, CheckCircle, Users, Link as LinkIcon } from 'lucide-react';
import { trackShareSuccess, trackSharePreflightBlocked } from '../lib/telemetry';

type PreflightResult = {
  has_access: boolean;
  access_reason: string;
  access_type: string;
  suggested_actions: Array<{
    action: string;
    label: string;
    description: string;
    client_id?: string;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
};

interface ShareDocumentModalProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShareDocumentModal({
  documentId,
  documentName,
  onClose,
  onSuccess,
}: ShareDocumentModalProps) {
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      checkPermissionPreflight();
    } else {
      setPreflightResult(null);
    }
  }, [selectedUserId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const checkPermissionPreflight = async () => {
    if (!selectedUserId) return;

    setCheckingAccess(true);
    try {
      const { data, error } = await supabase
        .rpc('check_effective_read_access', {
          p_doc_id: documentId,
          p_user_id: selectedUserId,
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setPreflightResult(data[0]);

        // Track if access would be blocked
        if (!data[0].has_access) {
          trackSharePreflightBlocked(documentId, 'User does not have access');
        }
      }
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleShare = async () => {
    if (!selectedUserId) {
      setError('Por favor selecciona un usuario');
      return;
    }

    // Warn if user won't have access
    if (preflightResult && !preflightResult.has_access) {
      const confirmed = confirm(
        '⚠️ ADVERTENCIA: El usuario NO tendrá acceso efectivo a este documento.\n\n' +
        'Esto significa que aunque lo compartas, no podrá verlo.\n\n' +
        '¿Deseas continuar de todas formas?'
      );

      if (!confirmed) {
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated');

      const shareData: any = {
        document_id: documentId,
        shared_with_user_id: selectedUserId,
        shared_by_user_id: user.id,
        permission,
      };

      if (expiresAt) {
        shareData.expires_at = new Date(expiresAt).toISOString();
      }

      const { error: shareError } = await supabase
        .from('document_shares')
        .insert(shareData);

      if (shareError) throw shareError;

      // Log audit
      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'SHARE',
        p_entity_type: 'document',
        p_entity_id: documentId,
        p_entity_name: documentName,
        p_metadata: {
          shared_with_user_id: selectedUserId,
          permission,
          has_effective_access: preflightResult?.has_access || false,
        },
      });

      trackShareSuccess(documentId, selectedUserId);

      alert('✅ Documento compartido exitosamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error sharing document:', error);
      setError(error.message || 'Error al compartir el documento');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedAction = async (action: string, clientId?: string) => {
    if (action === 'share_directly') {
      // Already in the share modal, just proceed
      alert('Por favor completa el formulario y haz click en "Compartir"');
    } else if (action === 'add_to_client' && clientId) {
      const confirmed = confirm(
        '¿Deseas agregar al usuario al espacio del cliente?\n\n' +
        'Esto le dará acceso a todos los documentos del cliente.'
      );

      if (confirmed) {
        try {
          const { error } = await supabase
            .from('client_users')
            .insert({
              client_id: clientId,
              user_id: selectedUserId,
              role: 'viewer',
              is_active: true,
            });

          if (error) throw error;

          alert('✅ Usuario agregado al espacio del cliente');
          // Re-check access
          checkPermissionPreflight();
        } catch (error: any) {
          alert(`Error: ${error.message}`);
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Share2 className="text-blue-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Compartir Documento</h2>
                <p className="text-sm text-gray-500">{documentName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users size={16} className="inline mr-1" />
              Compartir con
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Selecciona un usuario...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Permission Preflight Check */}
          {checkingAccess && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Verificando permisos...
              </div>
            </div>
          )}

          {preflightResult && !checkingAccess && (
            <>
              {preflightResult.has_access ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-900 mb-1">
                        ✅ El usuario TIENE acceso
                      </h4>
                      <p className="text-sm text-green-800">
                        {preflightResult.access_reason}
                      </p>
                      <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Tipo: {preflightResult.access_type}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-2">
                        ⚠️ El usuario NO tendrá acceso efectivo
                      </h4>
                      {preflightResult.warnings.map((warning, idx) => (
                        <p key={idx} className="text-sm text-red-800 mb-3">
                          {warning.message}
                        </p>
                      ))}

                      {preflightResult.suggested_actions.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-semibold text-red-900 text-sm mb-2">
                            Acciones sugeridas:
                          </h5>
                          <div className="space-y-2">
                            {preflightResult.suggested_actions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSuggestedAction(suggestion.action, suggestion.client_id)}
                                className="w-full text-left p-3 bg-white border border-red-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors"
                              >
                                <div className="font-medium text-gray-900 text-sm">
                                  {suggestion.label}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {suggestion.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permiso
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="read"
                  checked={permission === 'read'}
                  onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
                  className="text-blue-600"
                />
                <span className="text-sm">Solo lectura</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="write"
                  checked={permission === 'write'}
                  onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
                  className="text-blue-600"
                />
                <span className="text-sm">Lectura y escritura</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de expiración (opcional)
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Deja vacío para acceso permanente
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleShare}
            disabled={loading || !selectedUserId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Compartiendo...
              </>
            ) : (
              <>
                <Share2 size={18} />
                Compartir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
