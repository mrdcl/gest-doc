import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FileText, AlertCircle, ArrowLeft, Plus, Upload, Download, Trash2, Archive, CheckCircle2, Edit2 } from 'lucide-react';
import JSZip from 'jszip';
import { processDocumentOCR } from '../lib/ocrService';

type Movement = {
  id: string;
  movement_type_id: string;
  document_date: string;
  description: string;
  movement_types: { name: string; code: string };
};

type RequiredDocument = {
  id: string;
  name: string;
  description: string;
  is_required: boolean;
  is_optional: boolean;
  display_order: number;
};

type EntityDocument = {
  id: string;
  file_name: string;
  file_path: string;
  title: string;
  description: string;
  uploaded_at: string;
  file_date: string | null;
  required_document_id: string | null;
};

interface DocumentManagerProps {
  entityId: string;
  onBack: () => void;
  userRole: string;
}

export default function DocumentManager({ entityId, onBack, userRole }: DocumentManagerProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [entityName, setEntityName] = useState('');
  const [entityTypeId, setEntityTypeId] = useState('');
  const [movementTypes, setMovementTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<string | null>(null);
  const [newMovement, setNewMovement] = useState({
    movement_type_id: '',
    document_date: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, [entityId]);

  const fetchData = async () => {
    try {
      const [entityRes, movementsRes, movementTypesRes] = await Promise.all([
        supabase
          .from('entities')
          .select('name, entity_type_id')
          .eq('id', entityId)
          .single(),
        supabase
          .from('entity_movements')
          .select('*, movement_types(name, code)')
          .eq('entity_id', entityId),
        supabase
          .from('movement_types')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
      ]);

      if (entityRes.data) {
        setEntityName(entityRes.data.name);
        setEntityTypeId(entityRes.data.entity_type_id);
      }

      if (movementsRes.data) {
        const sortedMovements = movementsRes.data.sort((a, b) => {
          const codeA = a.movement_types?.code;
          const codeB = b.movement_types?.code;

          if (codeA === 'CONSTITUCION' && codeB !== 'CONSTITUCION') return -1;
          if (codeB === 'CONSTITUCION' && codeA !== 'CONSTITUCION') return 1;

          if (codeA === 'FUNCIONAMIENTO' && codeB !== 'FUNCIONAMIENTO') return 1;
          if (codeB === 'FUNCIONAMIENTO' && codeA !== 'FUNCIONAMIENTO') return -1;

          if (codeA === 'MODIFICACION' && codeB === 'MODIFICACION') {
            return new Date(a.document_date).getTime() - new Date(b.document_date).getTime();
          }

          return 0;
        });
        setMovements(sortedMovements);
      }

      if (movementTypesRes.data) setMovementTypes(movementTypesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('entity_movements')
        .insert({
          entity_id: entityId,
          movement_type_id: newMovement.movement_type_id,
          document_date: newMovement.document_date,
          description: newMovement.description,
          created_by: user.id,
        });

      if (error) throw error;

      setShowNewMovementModal(false);
      setNewMovement({ movement_type_id: '', document_date: '', description: '' });
      await fetchData();
    } catch (error) {
      console.error('Error creating movement:', error);
      alert('Error al crear el movimiento');
    }
  };

  const handleDownloadAllMovement = async (movementId: string) => {
    try {
      const { data: docs, error } = await supabase
        .from('entity_documents')
        .select('*')
        .eq('movement_id', movementId);

      if (error) throw error;

      if (!docs || docs.length === 0) {
        alert('No hay documentos para descargar en esta gestión');
        return;
      }

      const zip = new JSZip();
      let downloadedCount = 0;

      for (const doc of docs) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(doc.file_path);

          if (downloadError) {
            console.error(`Error descargando ${doc.file_name}:`, downloadError);
            continue;
          }

          zip.file(doc.file_name, fileData);
          downloadedCount++;
        } catch (err) {
          console.error(`Error procesando ${doc.file_name}:`, err);
        }
      }

      if (downloadedCount === 0) {
        alert('No se pudo descargar ningún documento');
        return;
      }

      const movement = movements.find(m => m.id === movementId);
      const zipName = `${entityName} - ${movement?.movement_types?.name || 'Documentos'}.zip`;

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Se descargaron ${downloadedCount} de ${docs.length} documentos`);
    } catch (error) {
      console.error('Error creando ZIP:', error);
      alert('Error al crear el archivo ZIP');
    }
  };

  const filteredMovements = movements.filter((mov) =>
    mov.movement_types?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mov.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando gestiones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{entityName}</h2>
            <p className="text-gray-600 mt-1">Gestiones documentales</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewMovementModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Nueva Gestión
        </button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          size={20}
        />
        <input
          type="text"
          placeholder="Buscar gestiones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredMovements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">
            {searchTerm ? 'No se encontraron gestiones' : 'No hay gestiones creadas'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowNewMovementModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Crear la primera gestión
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMovements.map((movement) => (
            <MovementCard
              key={movement.id}
              movement={movement}
              entityId={entityId}
              entityTypeId={entityTypeId}
              isExpanded={selectedMovement === movement.id}
              onToggle={() => setSelectedMovement(selectedMovement === movement.id ? null : movement.id)}
              onDownloadAll={() => handleDownloadAllMovement(movement.id)}
              onRefresh={fetchData}
              userRole={userRole}
            />
          ))}
        </div>
      )}

      {showNewMovementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Crear Nueva Gestión</h3>
            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Gestión *
                </label>
                <select
                  required
                  value={newMovement.movement_type_id}
                  onChange={(e) => setNewMovement({ ...newMovement, movement_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar tipo...</option>
                  {movementTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha del Documento *
                </label>
                <input
                  type="date"
                  required
                  value={newMovement.document_date}
                  onChange={(e) => setNewMovement({ ...newMovement, document_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={newMovement.description}
                  onChange={(e) => setNewMovement({ ...newMovement, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMovementModal(false);
                    setNewMovement({ movement_type_id: '', document_date: '', description: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Gestión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MovementCard({
  movement,
  entityId,
  entityTypeId,
  isExpanded,
  onToggle,
  onDownloadAll,
  onRefresh,
  userRole,
}: {
  movement: Movement;
  entityId: string;
  entityTypeId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDownloadAll: () => void;
  onRefresh: () => void;
  userRole: string;
}) {
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<EntityDocument[]>([]);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequiredDoc, setSelectedRequiredDoc] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<EntityDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file_date: '',
    file: null as File | null,
  });
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    file_date: '',
  });

  const isFuncionamiento = movement.movement_types?.code === 'FUNCIONAMIENTO';

  useEffect(() => {
    if (isExpanded) {
      fetchMovementDetails();
    }
  }, [isExpanded, movement.id]);

  const fetchMovementDetails = async () => {
    try {
      const [reqDocsRes, uploadedDocsRes, completionRes] = await Promise.all([
        supabase
          .from('required_documents')
          .select('*')
          .eq('movement_type_id', movement.movement_type_id)
          .or(`entity_type_id.is.null,entity_type_id.eq.${entityTypeId}`)
          .order('display_order'),
        supabase
          .from('entity_documents')
          .select('*')
          .eq('movement_id', movement.id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('movement_completion_status')
          .select('completion_percentage')
          .eq('movement_id', movement.id)
          .maybeSingle(),
      ]);

      if (reqDocsRes.data) setRequiredDocs(reqDocsRes.data);
      if (uploadedDocsRes.data) setUploadedDocs(uploadedDocsRes.data);
      if (completionRes.data) setCompletionPercentage(completionRes.data.completion_percentage);
    } catch (error) {
      console.error('Error fetching movement details:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      setErrorMessage('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${entityId}/${movement.id}/${Date.now()}.${fileExt}`;

      console.log('Subiendo archivo al storage:', fileName);
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadForm.file);

      if (uploadError) {
        console.error('Error en storage:', uploadError);
        throw new Error(`Error al subir archivo: ${uploadError.message}`);
      }

      console.log('Insertando documento en base de datos...');
      const insertData: any = {
        entity_id: entityId,
        movement_id: movement.id,
        file_name: uploadForm.file.name,
        file_path: fileName,
        file_size: uploadForm.file.size,
        mime_type: uploadForm.file.type || 'application/octet-stream',
        title: uploadForm.title,
        uploaded_by: user.id,
      };

      if (selectedRequiredDoc) {
        insertData.required_document_id = selectedRequiredDoc;
      }

      if (uploadForm.description) {
        insertData.description = uploadForm.description;
      }

      if (uploadForm.file_date) {
        insertData.file_date = uploadForm.file_date;
      }

      console.log('Datos a insertar:', insertData);

      const { data: insertedDoc, error: dbError } = await supabase
        .from('entity_documents')
        .insert(insertData)
        .select('id, mime_type')
        .single();

      if (dbError) {
        console.error('Error en base de datos:', dbError);
        await supabase.storage.from('documents').remove([fileName]);
        throw new Error(`Error al registrar documento: ${dbError.message}`);
      }

      console.log('Documento subido exitosamente');

      const mimeType = insertedDoc.mime_type?.toLowerCase() || '';
      const isProcessable = mimeType === 'application/pdf' || mimeType.startsWith('image/');

      if (isProcessable) {
        console.log('Iniciando procesamiento OCR en segundo plano...');
        processDocumentOCR(insertedDoc.id).then(success => {
          if (success) {
            console.log('OCR procesado exitosamente');
          } else {
            console.error('Error en procesamiento OCR');
          }
        }).catch(err => {
          console.error('Error llamando a OCR:', err);
        });
      }

      setShowUploadModal(false);
      setUploadForm({ title: '', description: '', file_date: '', file: null });
      setSelectedRequiredDoc(null);
      await fetchMovementDetails();
      await onRefresh();
    } catch (error: any) {
      console.error('Error completo:', error);
      setErrorMessage(error.message || 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;

    try {
      const { error } = await supabase
        .from('entity_documents')
        .update({
          title: editForm.title,
          description: editForm.description || null,
          file_date: editForm.file_date || null,
        })
        .eq('id', editingDoc.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingDoc(null);
      setEditForm({ title: '', description: '', file_date: '' });
      await fetchMovementDetails();
      await onRefresh();
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error al actualizar el documento');
    }
  };

  const handleDownload = async (doc: EntityDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };

  const handleDelete = async (doc: EntityDocument) => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return;

    try {
      await supabase.storage.from('documents').remove([doc.file_path]);
      await supabase.from('entity_documents').delete().eq('id', doc.id);
      await fetchMovementDetails();
      await onRefresh();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error al eliminar el documento');
    }
  };

  const openEditModal = (doc: EntityDocument) => {
    setEditingDoc(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || '',
      file_date: doc.file_date || '',
    });
    setShowEditModal(true);
  };

  const getDocumentForRequired = (requiredDocId: string) => {
    return uploadedDocs.find(d => d.required_document_id === requiredDocId);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="bg-white p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {movement.movement_types?.name}
              </h3>
              <span className="text-sm text-gray-500">
                {new Date(movement.document_date).toLocaleDateString()}
              </span>
            </div>
            {movement.description && (
              <p className="text-sm text-gray-600 mt-1">{movement.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!isFuncionamiento && (
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{completionPercentage}%</p>
                <p className="text-xs text-gray-500">completitud</p>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadAll();
              }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Descargar todo en ZIP"
            >
              <Archive size={20} />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="space-y-3">
            {isFuncionamiento ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-600">
                    Documentos de funcionamiento (sin límite)
                  </p>
                  <button
                    onClick={() => {
                      setSelectedRequiredDoc(null);
                      setErrorMessage('');
                      setShowUploadModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Upload size={16} />
                    Subir Documento
                  </button>
                </div>
                {uploadedDocs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay documentos subidos
                  </p>
                ) : (
                  uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between bg-white p-3 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="text-gray-400" size={20} />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          {doc.description && (
                            <p className="text-sm text-gray-600">{doc.description}</p>
                          )}
                          <p className="text-sm text-gray-500">{doc.file_name}</p>
                          <div className="text-xs text-gray-400">
                            {doc.file_date && (
                              <p>Fecha documento: {new Date(doc.file_date).toLocaleDateString()}</p>
                            )}
                            <p>Subido: {new Date(doc.uploaded_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(doc)}
                          className="text-gray-600 hover:text-gray-700 p-1"
                          title="Editar información"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Descargar"
                        >
                          <Download size={18} />
                        </button>
                        {(userRole === 'admin' || userRole === 'rc_abogados') && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              requiredDocs.map((reqDoc) => {
                const uploadedDoc = getDocumentForRequired(reqDoc.id);
                const isCompleted = !!uploadedDoc;

                return (
                  <div
                    key={reqDoc.id}
                    className={`flex items-center justify-between bg-white p-3 rounded-lg border ${
                      isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {isCompleted ? (
                        <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                      ) : (
                        <FileText className="text-gray-400 flex-shrink-0" size={20} />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${isCompleted ? 'text-green-900' : 'text-gray-900'}`}>
                            {reqDoc.name}
                          </p>
                          {reqDoc.is_optional && (
                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                              Opcional
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{reqDoc.description}</p>
                        {uploadedDoc && (
                          <div className="text-xs text-gray-400 mt-1">
                            {uploadedDoc.description && (
                              <p className="text-sm text-gray-600">{uploadedDoc.description}</p>
                            )}
                            <p>{uploadedDoc.file_name}</p>
                            {uploadedDoc.file_date && (
                              <p>Fecha documento: {new Date(uploadedDoc.file_date).toLocaleDateString()}</p>
                            )}
                            <p>Subido: {new Date(uploadedDoc.uploaded_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadedDoc ? (
                        <>
                          <button
                            onClick={() => openEditModal(uploadedDoc)}
                            className="text-gray-600 hover:text-gray-700 p-1"
                            title="Editar información"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDownload(uploadedDoc)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="Descargar"
                          >
                            <Download size={18} />
                          </button>
                          {(userRole === 'admin' || userRole === 'rc_abogados') && (
                            <button
                              onClick={() => handleDelete(uploadedDoc)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedRequiredDoc(reqDoc.id);
                            setUploadForm({ title: reqDoc.name, description: '', file_date: '', file: null });
                            setErrorMessage('');
                            setShowUploadModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Upload size={16} />
                          Subir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Subir Documento</h3>
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {errorMessage}
              </div>
            )}
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título del Documento *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha del Documento
                </label>
                <input
                  type="date"
                  value={uploadForm.file_date}
                  onChange={(e) => setUploadForm({ ...uploadForm, file_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fecha en que fue emitido el documento (opcional)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formatos permitidos: PDF, Word, Excel, imágenes (máx. 50MB)
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadForm({ title: '', description: '', file_date: '', file: null });
                    setSelectedRequiredDoc(null);
                    setErrorMessage('');
                  }}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Editar Información del Documento</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título del Documento *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha del Documento
                </label>
                <input
                  type="date"
                  value={editForm.file_date}
                  onChange={(e) => setEditForm({ ...editForm, file_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Archivo actual:</strong> {editingDoc.file_name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  El archivo no se puede modificar. Para cambiar el archivo, elimine este documento y suba uno nuevo.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDoc(null);
                    setEditForm({ title: '', description: '', file_date: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
