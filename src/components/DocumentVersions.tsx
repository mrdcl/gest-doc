import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { History, RotateCcw, X, FileText, AlertCircle, CheckCircle, Undo2 } from 'lucide-react';
import DiffMatchPatch from 'diff-match-patch';

type DocumentVersion = {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  file_size: number;
  content_text: string;
  changes_description: string;
  created_by: string;
  created_at: string;
  creator_email: string;
  creator_name: string;
};

interface DocumentVersionsProps {
  documentId: string;
  documentName: string;
  currentVersion: number;
  onClose: () => void;
  onVersionRestored: () => void;
}

export default function DocumentVersions({
  documentId,
  documentName,
  currentVersion,
  onClose,
  onVersionRestored,
}: DocumentVersionsProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffHtml, setDiffHtml] = useState('');
  const [reverting, setReverting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [undoAction, setUndoAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select(`
          *,
          creator:created_by(email, full_name)
        `)
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      // Flatten the creator data
      const formattedData = (data || []).map(v => ({
        ...v,
        creator_email: v.creator?.email || 'unknown',
        creator_name: v.creator?.full_name || 'Unknown',
      }));

      setVersions(formattedData);
    } catch (error) {
      console.error('Error fetching versions:', error);
      alert('Error al cargar versiones');
    } finally {
      setLoading(false);
    }
  };

  const generateDiff = (oldText: string, newText: string): string => {
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(oldText || '', newText || '');
    dmp.diff_cleanupSemantic(diffs);

    let html = '<div class="font-mono text-sm whitespace-pre-wrap">';
    diffs.forEach(([operation, text]) => {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

      if (operation === 1) {
        // Insertion
        html += `<span class="bg-green-200 text-green-900">${escaped}</span>`;
      } else if (operation === -1) {
        // Deletion
        html += `<span class="bg-red-200 text-red-900 line-through">${escaped}</span>`;
      } else {
        // No change
        html += `<span class="text-gray-700">${escaped}</span>`;
      }
    });
    html += '</div>';

    return html;
  };

  const compareToPrevious = async (version: DocumentVersion) => {
    const versionIndex = versions.findIndex(v => v.id === version.id);
    if (versionIndex === versions.length - 1) {
      alert('Esta es la primera versión, no hay versión previa para comparar');
      return;
    }

    const previousVersion = versions[versionIndex + 1];
    const diff = generateDiff(previousVersion.content_text, version.content_text);

    setDiffHtml(diff);
    setSelectedVersion(version);
    setShowDiff(true);
  };

  const revertToVersion = async (version: DocumentVersion) => {
    const confirmed = confirm(
      `¿Revertir a la versión ${version.version_number}?\n\n` +
      `Esto creará una nueva versión con el contenido de la versión ${version.version_number}.\n` +
      `La versión actual se conservará en el historial.`
    );

    if (!confirmed) return;

    setReverting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated');

      // Get current document data
      const { data: currentDoc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      // Create new version with reverted content
      const newVersionNumber = currentVersion + 1;

      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          version_number: newVersionNumber,
          file_path: version.file_path,
          file_size: version.file_size,
          content_text: version.content_text,
          changes_description: `Revertido a versión ${version.version_number}`,
          created_by: user.id,
        });

      if (versionError) throw versionError;

      // Update document
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_path: version.file_path,
          file_size: version.file_size,
          content_text: version.content_text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      // Show toast with undo option
      setToastMessage(`✅ Documento revertido a versión ${version.version_number}`);
      setShowToast(true);

      // Setup undo action
      const undo = async () => {
        try {
          // Restore to current version
          await supabase
            .from('documents')
            .update({
              file_path: currentDoc.file_path,
              file_size: currentDoc.file_size,
              content_text: currentDoc.content_text,
              updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

          // Delete the revert version
          await supabase
            .from('document_versions')
            .delete()
            .eq('document_id', documentId)
            .eq('version_number', newVersionNumber);

          setToastMessage('↩️ Reversión deshecha');
          setShowToast(true);
          setUndoAction(null);

          setTimeout(() => {
            setShowToast(false);
            onVersionRestored();
          }, 2000);
        } catch (error) {
          console.error('Error undoing revert:', error);
          alert('Error al deshacer la reversión');
        }
      };

      setUndoAction(() => undo);

      // Auto-hide toast after 8 seconds
      setTimeout(() => {
        setShowToast(false);
        setUndoAction(null);
      }, 8000);

      // Refresh versions
      fetchVersions();
      onVersionRestored();
    } catch (error: any) {
      console.error('Error reverting version:', error);
      alert(`Error al revertir: ${error.message}`);
    } finally {
      setReverting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando versiones...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <History className="text-blue-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Historial de Versiones</h2>
                <p className="text-sm text-gray-500">{documentName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            {versions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No hay versiones previas de este documento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`border rounded-lg p-4 transition-all ${
                      version.version_number === currentVersion
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            Versión {version.version_number}
                          </h3>
                          {version.version_number === currentVersion && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                              Actual
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          {version.changes_description || 'Sin descripción'}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Por: {version.creator_name}</span>
                          <span>•</span>
                          <span>{new Date(version.created_at).toLocaleString('es-CL')}</span>
                          <span>•</span>
                          <span>{(version.file_size / 1024).toFixed(2)} KB</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {index < versions.length - 1 && (
                          <button
                            onClick={() => compareToPrevious(version)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            title="Comparar con versión anterior"
                          >
                            Ver cambios
                          </button>
                        )}

                        {version.version_number !== currentVersion && (
                          <button
                            onClick={() => revertToVersion(version)}
                            disabled={reverting}
                            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            <RotateCcw size={16} />
                            Revertir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diff Modal */}
      {showDiff && selectedVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Cambios en Versión {selectedVersion.version_number}
                </h3>
                <p className="text-sm text-gray-500">
                  Comparación con versión anterior
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDiff(false);
                  setSelectedVersion(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-200 rounded"></span>
                    <span>Agregado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-200 rounded"></span>
                    <span>Eliminado</span>
                  </div>
                </div>
              </div>

              <div
                className="border border-gray-200 rounded-lg p-4 bg-white overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: diffHtml }}
              />
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDiff(false);
                  setSelectedVersion(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setShowDiff(false);
                  revertToVersion(selectedVersion);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={18} />
                Revertir a esta versión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast with Undo */}
      {showToast && (
        <div className="fixed bottom-8 right-8 bg-gray-900 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 z-[70] animate-slide-up">
          <CheckCircle className="text-green-400" size={24} />
          <span className="font-medium">{toastMessage}</span>

          {undoAction && (
            <button
              onClick={() => {
                undoAction();
                setShowToast(false);
              }}
              className="ml-4 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium"
            >
              <Undo2 size={16} />
              Deshacer
            </button>
          )}

          <button
            onClick={() => {
              setShowToast(false);
              setUndoAction(null);
            }}
            className="ml-2 p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
