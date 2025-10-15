import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Edit2, Trash2, X, Save, AlertTriangle, FileText } from 'lucide-react';

type Movement = {
  id: string;
  entity_id: string;
  movement_type_id: string;
  subcategory_id?: string;
  document_date: string;
  description: string;
  notes: string;
  created_at: string;
  movement_type_name?: string;
  subcategory_name?: string;
  has_low_quality_ocr?: boolean;
};

type MovementType = {
  id: string;
  name: string;
  code: string;
};

type Subcategory = {
  id: string;
  name: string;
  movement_type_id: string;
};

interface MovementManagerProps {
  entityId: string;
  entityName: string;
  onClose: () => void;
}

export default function MovementManager({ entityId, entityName, onClose }: MovementManagerProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Movement>>({});

  useEffect(() => {
    fetchData();
  }, [entityId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch movements with OCR quality info
      const { data: movementsData, error: movementsError } = await supabase
        .from('entity_movements')
        .select(`
          *,
          movement_types(name),
          movement_subcategories(name),
          documents(id, content_text, has_low_quality_ocr)
        `)
        .eq('entity_id', entityId)
        .order('document_date', { ascending: false });

      if (movementsError) throw movementsError;

      // Check for low quality OCR in any related documents
      const formattedMovements = (movementsData || []).map(m => ({
        id: m.id,
        entity_id: m.entity_id,
        movement_type_id: m.movement_type_id,
        subcategory_id: m.subcategory_id,
        document_date: m.document_date,
        description: m.description || '',
        notes: m.notes || '',
        created_at: m.created_at,
        movement_type_name: m.movement_types?.name,
        subcategory_name: m.movement_subcategories?.name,
        has_low_quality_ocr: m.documents?.some((d: any) => d.has_low_quality_ocr) || false,
      }));

      setMovements(formattedMovements);

      // Fetch movement types
      const { data: typesData, error: typesError } = await supabase
        .from('movement_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) throw typesError;
      setMovementTypes(typesData || []);

      // Fetch subcategories
      const { data: subcatsData, error: subcatsError } = await supabase
        .from('movement_subcategories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (subcatsError) throw subcatsError;
      setSubcategories(subcatsData || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
      alert('Error al cargar las gestiones');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (movement: Movement) => {
    setEditingId(movement.id);
    setEditForm({
      movement_type_id: movement.movement_type_id,
      subcategory_id: movement.subcategory_id || '',
      document_date: movement.document_date,
      description: movement.description,
      notes: movement.notes,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (movementId: string) => {
    try {
      const { error } = await supabase
        .from('entity_movements')
        .update({
          movement_type_id: editForm.movement_type_id,
          subcategory_id: editForm.subcategory_id || null,
          document_date: editForm.document_date,
          description: editForm.description,
          notes: editForm.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', movementId);

      if (error) throw error;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('log_audit_action', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_action: 'UPDATE',
          p_entity_type: 'movement',
          p_entity_id: movementId,
          p_entity_name: editForm.description || 'Gestión',
          p_metadata: { changes: editForm },
        });
      }

      alert('✅ Gestión actualizada exitosamente');
      setEditingId(null);
      setEditForm({});
      fetchData();
    } catch (error) {
      console.error('Error updating movement:', error);
      alert('Error al actualizar la gestión');
    }
  };

  const deleteMovement = async (movementId: string, description: string) => {
    const confirmed = confirm(
      `¿Estás seguro de eliminar la gestión "${description}"?\n\n` +
      'Esta acción no se puede deshacer.'
    );

    if (!confirmed) return;

    try {
      // Check if there are documents associated
      const { data: docs } = await supabase
        .from('documents')
        .select('id')
        .eq('movement_id', movementId);

      if (docs && docs.length > 0) {
        const confirmWithDocs = confirm(
          `⚠️ Esta gestión tiene ${docs.length} documento(s) asociado(s).\n\n` +
          'Los documentos se mantendrán pero perderán la asociación con esta gestión.\n\n' +
          '¿Deseas continuar?'
        );

        if (!confirmWithDocs) return;

        // Remove movement association from documents
        await supabase
          .from('documents')
          .update({ movement_id: null })
          .eq('movement_id', movementId);
      }

      const { error } = await supabase
        .from('entity_movements')
        .delete()
        .eq('id', movementId);

      if (error) throw error;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('log_audit_action', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_action: 'DELETE',
          p_entity_type: 'movement',
          p_entity_id: movementId,
          p_entity_name: description,
          p_metadata: { entity_id: entityId },
        });
      }

      alert('✅ Gestión eliminada exitosamente');
      fetchData();
    } catch (error) {
      console.error('Error deleting movement:', error);
      alert('Error al eliminar la gestión');
    }
  };

  const getAvailableSubcategories = (typeId: string) => {
    return subcategories.filter(s => s.movement_type_id === typeId);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando gestiones...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestiones de {entityName}</h2>
            <p className="text-sm text-gray-500">Editar o eliminar gestiones registradas</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {movements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">No hay gestiones registradas para esta sociedad</p>
            </div>
          ) : (
            <div className="space-y-4">
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className={`border rounded-lg p-4 ${
                    movement.has_low_quality_ocr
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {editingId === movement.id ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de Gestión *
                          </label>
                          <select
                            value={editForm.movement_type_id || ''}
                            onChange={(e) => setEditForm({ ...editForm, movement_type_id: e.target.value, subcategory_id: '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Seleccionar...</option>
                            {movementTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subcategoría
                          </label>
                          <select
                            value={editForm.subcategory_id || ''}
                            onChange={(e) => setEditForm({ ...editForm, subcategory_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={!editForm.movement_type_id}
                          >
                            <option value="">Sin subcategoría</option>
                            {editForm.movement_type_id &&
                              getAvailableSubcategories(editForm.movement_type_id).map((subcat) => (
                                <option key={subcat.id} value={subcat.id}>
                                  {subcat.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha del Documento *
                        </label>
                        <input
                          type="date"
                          value={editForm.document_date || ''}
                          onChange={(e) => setEditForm({ ...editForm, document_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción
                        </label>
                        <input
                          type="text"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Descripción breve..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notas
                        </label>
                        <textarea
                          value={editForm.notes || ''}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Notas adicionales..."
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveEdit(movement.id)}
                          disabled={!editForm.movement_type_id || !editForm.document_date}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Save size={18} />
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {movement.movement_type_name}
                              {movement.subcategory_name && (
                                <span className="text-gray-600 font-normal"> / {movement.subcategory_name}</span>
                              )}
                            </h3>
                            {movement.has_low_quality_ocr && (
                              <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 border border-orange-300 rounded text-orange-700 text-xs font-medium">
                                <AlertTriangle size={14} />
                                OCR Baja Calidad
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium">Fecha:</span>{' '}
                            {new Date(movement.document_date).toLocaleDateString('es-CL')}
                          </p>
                          {movement.description && (
                            <p className="text-sm text-gray-700 mb-1">
                              <span className="font-medium">Descripción:</span> {movement.description}
                            </p>
                          )}
                          {movement.notes && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Notas:</span> {movement.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => startEdit(movement)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar gestión"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteMovement(movement.id, movement.description || movement.movement_type_name || 'Gestión')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar gestión"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {movement.has_low_quality_ocr && (
                        <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={16} />
                            <p className="text-sm text-orange-800">
                              Uno o más documentos de esta gestión tienen OCR de baja calidad y pueden no aparecer en búsquedas.
                              Considera reprocesar los documentos para mejorar la indexación.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
