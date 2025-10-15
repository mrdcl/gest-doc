import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Building, AlertCircle } from 'lucide-react';

type EntityType = {
  id: string;
  name: string;
  code: string;
};

interface EntityEditorProps {
  entityId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EntityEditor({ entityId, onClose, onSuccess }: EntityEditorProps) {
  const [entity, setEntity] = useState({
    name: '',
    rut: '',
    entity_type_id: '',
    legal_representative: '',
    address: '',
    email: '',
    phone: '',
    tax_regime: '',
    business_activity: '',
  });
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [entityId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch entity data
      const { data: entityData, error: entityError } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (entityError) throw entityError;

      setEntity({
        name: entityData.name || '',
        rut: entityData.rut || '',
        entity_type_id: entityData.entity_type_id || '',
        legal_representative: entityData.legal_representative || '',
        address: entityData.address || '',
        email: entityData.email || '',
        phone: entityData.phone || '',
        tax_regime: entityData.tax_regime || '',
        business_activity: entityData.business_activity || '',
      });

      // Fetch entity types
      const { data: typesData, error: typesError } = await supabase
        .from('entity_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (typesError) throw typesError;
      setEntityTypes(typesData || []);
    } catch (error) {
      console.error('Error fetching entity:', error);
      setError('Error al cargar los datos de la sociedad');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!entity.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    if (!entity.rut.trim()) {
      setError('El RUT es obligatorio');
      return;
    }

    if (!entity.entity_type_id) {
      setError('El tipo de sociedad es obligatorio');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('entities')
        .update({
          name: entity.name.trim(),
          rut: entity.rut.trim(),
          entity_type_id: entity.entity_type_id,
          legal_representative: entity.legal_representative.trim() || null,
          address: entity.address.trim() || null,
          email: entity.email.trim() || null,
          phone: entity.phone.trim() || null,
          tax_regime: entity.tax_regime.trim() || null,
          business_activity: entity.business_activity.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entityId);

      if (updateError) throw updateError;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('log_audit_action', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_action: 'UPDATE',
          p_entity_type: 'entity',
          p_entity_id: entityId,
          p_entity_name: entity.name,
          p_metadata: { updated_fields: Object.keys(entity) },
        });
      }

      alert('✅ Sociedad actualizada exitosamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating entity:', error);
      setError(error.message || 'Error al actualizar la sociedad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Editar Sociedad</h2>
              <p className="text-sm text-gray-500">Modificar los datos de la sociedad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Datos Básicos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Datos Básicos</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Sociedad *
                </label>
                <input
                  type="text"
                  value={entity.name}
                  onChange={(e) => setEntity({ ...entity, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Inversiones del Sur S.A."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RUT *
                </label>
                <input
                  type="text"
                  value={entity.rut}
                  onChange={(e) => setEntity({ ...entity, rut: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 12.345.678-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Sociedad *
              </label>
              <select
                value={entity.entity_type_id}
                onChange={(e) => setEntity({ ...entity, entity_type_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar tipo...</option>
                {entityTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Representante Legal
              </label>
              <input
                type="text"
                value={entity.legal_representative}
                onChange={(e) => setEntity({ ...entity, legal_representative: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre del representante legal"
              />
            </div>
          </div>

          {/* Datos de Contacto */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Datos de Contacto</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={entity.address}
                onChange={(e) => setEntity({ ...entity, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Dirección completa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={entity.email}
                  onChange={(e) => setEntity({ ...entity, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={entity.phone}
                  onChange={(e) => setEntity({ ...entity, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </div>
          </div>

          {/* Datos Tributarios */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Datos Tributarios y Actividad</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Régimen Tributario
              </label>
              <input
                type="text"
                value={entity.tax_regime}
                onChange={(e) => setEntity({ ...entity, tax_regime: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Renta Presunta, 14 ter A, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Giro o Actividad Comercial
              </label>
              <textarea
                value={entity.business_activity}
                onChange={(e) => setEntity({ ...entity, business_activity: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Descripción de la actividad comercial..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
