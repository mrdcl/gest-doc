import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import { Plus, Search, Building, AlertCircle, ArrowLeft, Edit2, FolderOpen } from 'lucide-react';
import EntityEditor from './EntityEditor';
import MovementManager from './MovementManager';

type Entity = Database['public']['Tables']['entities']['Row'] & {
  entity_types?: { name: string };
};
type EntityType = Database['public']['Tables']['entity_types']['Row'];

interface EntityListProps {
  clientId: string;
  onSelectEntity: (entityId: string) => void;
  onBack: () => void;
  userRole: string;
}

export default function EntityList({ clientId, onSelectEntity, onBack, userRole }: EntityListProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>([]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEntity, setNewEntity] = useState({
    name: '',
    rut: '',
    entity_type_id: '',
    legal_representative: '',
    address: '',
  });
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [managingMovements, setManagingMovements] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      const [clientRes, entitiesRes, typesRes] = await Promise.all([
        supabase.from('clients').select('name').eq('id', clientId).single(),
        supabase
          .from('entities')
          .select('*, entity_types(name)')
          .eq('client_id', clientId)
          .order('name'),
        supabase.from('entity_types').select('*').eq('is_active', true).order('display_order'),
      ]);

      if (clientRes.data) setClientName(clientRes.data.name);
      if (entitiesRes.data) setEntities(entitiesRes.data);
      if (typesRes.data) setEntityTypes(typesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('entities')
        .insert({
          ...newEntity,
          client_id: clientId,
        });

      if (error) throw error;

      setShowCreateModal(false);
      setNewEntity({
        name: '',
        rut: '',
        entity_type_id: '',
        legal_representative: '',
        address: '',
      });
      fetchData();
    } catch (error) {
      console.error('Error creating entity:', error);
      alert('Error al crear la sociedad');
    }
  };

  const filteredEntities = entities.filter(entity =>
    entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entity.rut.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando sociedades...</div>
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
            <h2 className="text-2xl font-bold text-gray-900">{clientName}</h2>
            <p className="text-gray-600 mt-1">
              Sociedades y entidades del cliente
            </p>
          </div>
        </div>
        {(userRole === 'admin' || userRole === 'rc_abogados') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Sociedad
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por nombre o RUT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filteredEntities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">
            {searchTerm ? 'No se encontraron sociedades' : 'No hay sociedades registradas para este cliente'}
          </p>
          {!searchTerm && (userRole === 'admin' || userRole === 'rc_abogados') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Crear la primera sociedad
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntities.map((entity) => (
            <div
              key={entity.id}
              className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                  <Building className="text-green-600" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {entity.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">RUT: {entity.rut}</p>
                  {entity.entity_types && (
                    <p className="text-sm text-gray-500 mt-1">
                      {entity.entity_types.name}
                    </p>
                  )}
                  {entity.legal_representative && (
                    <p className="text-xs text-gray-400 mt-2">
                      Rep. Legal: {entity.legal_representative}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEntity(entity.id);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ver Documentos
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setManagingMovements({ id: entity.id, name: entity.name });
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Gestionar gestiones"
                >
                  <FolderOpen size={18} />
                </button>
                {(userRole === 'admin' || userRole === 'rc_abogados') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingEntity(entity.id);
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Editar sociedad"
                  >
                    <Edit2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entity Editor Modal */}
      {editingEntity && (
        <EntityEditor
          entityId={editingEntity}
          onClose={() => setEditingEntity(null)}
          onSuccess={() => {
            setEditingEntity(null);
            fetchData();
          }}
        />
      )}

      {/* Movement Manager Modal */}
      {managingMovements && (
        <MovementManager
          entityId={managingMovements.id}
          entityName={managingMovements.name}
          onClose={() => setManagingMovements(null)}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Crear Nueva Sociedad</h3>
            <form onSubmit={handleCreateEntity} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={newEntity.name}
                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT *
                </label>
                <input
                  type="text"
                  required
                  value={newEntity.rut}
                  onChange={(e) => setNewEntity({ ...newEntity, rut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Sociedad *
                </label>
                <select
                  required
                  value={newEntity.entity_type_id}
                  onChange={(e) => setNewEntity({ ...newEntity, entity_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Representante Legal
                </label>
                <input
                  type="text"
                  value={newEntity.legal_representative}
                  onChange={(e) => setNewEntity({ ...newEntity, legal_representative: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={newEntity.address}
                  onChange={(e) => setNewEntity({ ...newEntity, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Sociedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
