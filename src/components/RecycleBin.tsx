import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, RotateCcw, X as XIcon, AlertTriangle, Calendar, User, Building, FileText } from 'lucide-react';

type DeletedDocument = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  entity_name: string;
  client_name: string;
  deleted_at: string;
  deleted_by_name: string | null;
};

export default function RecycleBin() {
  const [documents, setDocuments] = useState<DeletedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<DeletedDocument | null>(null);
  const [actionType, setActionType] = useState<'restore' | 'delete' | null>(null);

  useEffect(() => {
    fetchDeletedDocuments();
  }, []);

  const fetchDeletedDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recycle_bin')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching deleted documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreDocument = async (docId: string) => {
    try {
      const { error } = await supabase.rpc('restore_document', {
        p_document_id: docId
      });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const doc = documents.find(d => d.id === docId);
        await supabase.rpc('log_audit_action', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_action: 'RESTORE',
          p_entity_type: 'document',
          p_entity_id: docId,
          p_entity_name: doc?.file_name || 'Unknown',
          p_metadata: { source: 'recycle_bin' }
        });
      }

      fetchDeletedDocuments();
      setSelectedDoc(null);
      setActionType(null);
    } catch (error: any) {
      console.error('Error restoring document:', error);
      alert('Error al restaurar el documento');
    }
  };

  const permanentlyDelete = async (docId: string) => {
    try {
      const { error } = await supabase.rpc('permanently_delete_document', {
        p_document_id: docId
      });

      if (error) throw error;

      fetchDeletedDocuments();
      setSelectedDoc(null);
      setActionType(null);
    } catch (error: any) {
      console.error('Error permanently deleting document:', error);
      alert('Error al eliminar permanentemente el documento');
    }
  };

  const getDaysInBin = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - deleted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase().endsWith('.pdf')) {
      return <FileText className="text-red-600" size={20} />;
    }
    return <FileText className="text-gray-600" size={20} />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Cargando papelera...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="text-red-600" size={32} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Papelera de Reciclaje</h2>
          <p className="text-sm text-gray-500 mt-1">
            Documentos eliminados • Se eliminan automáticamente después de 30 días
          </p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Trash2 size={48} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">La papelera está vacía</p>
        </div>
      ) : (
        <>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Atención</p>
                <p>
                  Los documentos en la papelera se eliminan automáticamente después de 30 días.
                  Puedes restaurarlos o eliminarlos permanentemente antes de ese tiempo.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente / Sociedad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eliminado por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Días en papelera
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => {
                  const daysInBin = getDaysInBin(doc.deleted_at);
                  const isExpiringSoon = daysInBin >= 25;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.file_name)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {doc.title || doc.file_name}
                            </div>
                            <div className="text-xs text-gray-500">{doc.file_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900">{doc.client_name}</div>
                            <div className="text-xs text-gray-500">{doc.entity_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {doc.deleted_by_name || 'Usuario desconocido'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {new Date(doc.deleted_at).toLocaleDateString('es-CL')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            isExpiringSoon
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {daysInBin} {daysInBin === 1 ? 'día' : 'días'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setActionType('restore');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Restaurar"
                          >
                            <RotateCcw size={16} />
                            Restaurar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setActionType('delete');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-600">
            {documents.length} documento{documents.length !== 1 ? 's' : ''} en la papelera
          </div>
        </>
      )}

      {selectedDoc && actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {actionType === 'restore' ? 'Restaurar Documento' : 'Eliminar Permanentemente'}
              </h3>
              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setActionType(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="mb-6">
              {actionType === 'restore' ? (
                <div className="space-y-3">
                  <p className="text-gray-600">
                    ¿Deseas restaurar el siguiente documento?
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {getFileIcon(selectedDoc.file_name)}
                      <span className="font-medium text-gray-900">
                        {selectedDoc.title || selectedDoc.file_name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Cliente: {selectedDoc.client_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Sociedad: {selectedDoc.entity_name}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    El documento será restaurado a su ubicación original.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="font-medium text-red-900 mb-2">
                          ¡Advertencia! Esta acción es irreversible
                        </p>
                        <p className="text-sm text-red-800">
                          El documento será eliminado permanentemente y no podrá ser recuperado.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {getFileIcon(selectedDoc.file_name)}
                      <span className="font-medium text-gray-900">
                        {selectedDoc.title || selectedDoc.file_name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Cliente: {selectedDoc.client_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Sociedad: {selectedDoc.entity_name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setActionType(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (actionType === 'restore') {
                    restoreDocument(selectedDoc.id);
                  } else {
                    permanentlyDelete(selectedDoc.id);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                  actionType === 'restore'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {actionType === 'restore' ? (
                  <>
                    <RotateCcw size={18} />
                    Restaurar
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Eliminar Permanentemente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
