import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link2, Copy, Check, Clock, Hash, Download, Eye, Trash2, X } from 'lucide-react';

interface ShareableLinkModalProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
}

interface SharedLink {
  id: string;
  token: string;
  expires_at: string;
  permissions: {
    read: boolean;
    download: boolean;
  };
  access_count: number;
  max_access_count: number | null;
  is_active: boolean;
  last_accessed_at: string | null;
  created_at: string;
}

export default function ShareableLinkModal({ documentId, documentName, onClose }: ShareableLinkModalProps) {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [newLink, setNewLink] = useState({
    expiresIn: '7',
    maxAccessCount: '',
    allowDownload: false,
  });

  useEffect(() => {
    fetchLinks();
  }, [documentId]);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('shared_links')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const array = new Uint8Array(11);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
  };

  const generateHmacSignature = async (token: string, docId: string, expiresAt: Date): Promise<string> => {
    const payload = `${token}|${docId}|${Math.floor(expiresAt.getTime() / 1000)}`;
    const secret = import.meta.env.VITE_HMAC_SECRET || 'default-secret-change-in-production';

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const createShareableLink = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(newLink.expiresIn));

      const hmacSignature = await generateHmacSignature(token, documentId, expiresAt);

      const linkData = {
        token,
        document_id: documentId,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        permissions: {
          read: true,
          download: newLink.allowDownload,
        },
        max_access_count: newLink.maxAccessCount ? parseInt(newLink.maxAccessCount) : null,
        hmac_signature: hmacSignature,
      };

      const { data, error } = await supabase
        .from('shared_links')
        .insert(linkData)
        .select()
        .single();

      if (error) throw error;

      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'CREATE',
        p_entity_type: 'shared_link',
        p_entity_id: data.id,
        p_entity_name: `Link for ${documentName}`,
        p_metadata: {
          document_id: documentId,
          expires_in_days: newLink.expiresIn,
          allow_download: newLink.allowDownload,
        },
      });

      setNewLink({
        expiresIn: '7',
        maxAccessCount: '',
        allowDownload: false,
      });

      await fetchLinks();
      alert('✅ Enlace creado exitosamente');
    } catch (error: any) {
      console.error('Error creating link:', error);
      alert(`❌ Error al crear enlace: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (token: string) => {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/share/${token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('❌ Error al copiar al portapapeles');
    }
  };

  const deactivateLink = async (linkId: string, token: string) => {
    if (!confirm('¿Desactivar este enlace? Ya no será accesible.')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('shared_links')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', linkId);

      if (error) throw error;

      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'UPDATE',
        p_entity_type: 'shared_link',
        p_entity_id: linkId,
        p_entity_name: `Link ${token}`,
        p_metadata: {
          action: 'deactivated',
          document_id: documentId,
        },
      });

      await fetchLinks();
      alert('✅ Enlace desactivado');
    } catch (error: any) {
      console.error('Error deactivating link:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const deleteLink = async (linkId: string, token: string) => {
    if (!confirm('¿Eliminar permanentemente este enlace?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('shared_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'DELETE',
        p_entity_type: 'shared_link',
        p_entity_id: linkId,
        p_entity_name: `Link ${token}`,
        p_metadata: {
          document_id: documentId,
        },
      });

      await fetchLinks();
      alert('✅ Enlace eliminado');
    } catch (error: any) {
      console.error('Error deleting link:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  const getLinkStatus = (link: SharedLink) => {
    const now = new Date();
    const expiresAt = new Date(link.expires_at);

    if (!link.is_active) return { text: 'Desactivado', color: 'text-gray-500' };
    if (expiresAt < now) return { text: 'Expirado', color: 'text-red-500' };
    if (link.max_access_count && link.access_count >= link.max_access_count) {
      return { text: 'Límite alcanzado', color: 'text-orange-500' };
    }
    return { text: 'Activo', color: 'text-green-500' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff < 0) return 'Expirado';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h restantes`;
    if (hours > 0) return `${hours}h restantes`;
    return 'Menos de 1h';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Link2 className="w-6 h-6" />
              Enlaces Compartibles
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Documento: <span className="font-medium">{documentName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Crear Nuevo Enlace</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Expira en
                </label>
                <select
                  value={newLink.expiresIn}
                  onChange={(e) => setNewLink({ ...newLink, expiresIn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">1 día</option>
                  <option value="3">3 días</option>
                  <option value="7">7 días</option>
                  <option value="14">14 días</option>
                  <option value="30">30 días</option>
                  <option value="90">90 días</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  Límite de accesos (opcional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  value={newLink.maxAccessCount}
                  onChange={(e) => setNewLink({ ...newLink, maxAccessCount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLink.allowDownload}
                    onChange={(e) => setNewLink({ ...newLink, allowDownload: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-medium text-gray-700">Permitir descarga</span>
                </label>
              </div>
            </div>

            <button
              onClick={createShareableLink}
              disabled={creating}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {creating ? 'Creando...' : 'Crear Enlace'}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando enlaces...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay enlaces creados para este documento
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Enlaces Existentes ({links.length})</h3>

              {links.map((link) => {
                const status = getLinkStatus(link);
                const baseUrl = window.location.origin;
                const shareUrl = `${baseUrl}/share/${link.token}`;

                return (
                  <div
                    key={link.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-medium ${status.color}`}>
                            {status.text}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getTimeRemaining(link.expires_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {link.token}
                          </code>
                          <button
                            onClick={() => copyToClipboard(link.token)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Copiar enlace"
                          >
                            {copiedToken === link.token ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {link.access_count} accesos
                              {link.max_access_count && ` / ${link.max_access_count} máx`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expira: {formatDate(link.expires_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={link.permissions.download ? 'text-green-600' : 'text-gray-400'}>
                              <Download className="w-3 h-3 inline" />
                              {link.permissions.download ? 'Descarga permitida' : 'Solo lectura'}
                            </span>
                          </div>
                          {link.last_accessed_at && (
                            <div className="text-gray-500">
                              Último acceso: {formatDate(link.last_accessed_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {link.is_active && (
                          <button
                            onClick={() => deactivateLink(link.id, link.token)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                            title="Desactivar enlace"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteLink(link.id, link.token)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Eliminar enlace"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {link.is_active && new Date(link.expires_at) > new Date() && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono break-all">
                        {shareUrl}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          <p className="mb-1">
            <strong>Nota:</strong> Los enlaces compartibles permiten acceso temporal sin autenticación.
          </p>
          <p>
            Los enlaces expirados se desactivan automáticamente y se eliminan después de 30 días.
          </p>
        </div>
      </div>
    </div>
  );
}
