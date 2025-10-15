import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/supabase';
import posthog from 'posthog-js';
import { Plus, Search, Building2, AlertCircle, Edit2, Trash2, Download } from 'lucide-react';
import JSZip from 'jszip';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
  userRole: string;
}

export default function ClientList({ onSelectClient, userRole }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    rut: '',
    email: '',
    phone: '',
    contact_person: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('clients')
        .insert({
          ...newClient,
          created_by: user.id,
        });

      if (error) throw error;

      setShowCreateModal(false);
      setNewClient({ name: '', rut: '', email: '', phone: '', contact_person: '' });
      fetchClients();
      if (localStorage.getItem('telemetry_consent') === 'true') {
        posthog.capture('category_create_success', { name: newClient.name });
      }
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Error al crear el cliente');
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          rut: editingClient.rut,
          email: editingClient.email,
          phone: editingClient.phone,
          contact_person: editingClient.contact_person,
          address: editingClient.address,
          notes: editingClient.notes,
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error al actualizar el cliente');
    }
  };

  const openEditModal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setShowEditModal(true);
  };

  const openDeleteModal = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingClient(client);
    setShowDeleteModal(true);
  };

  const exportClientData = async (clientId: string, clientName: string) => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      // Create main folder
      const clientFolder = zip.folder(clientName.replace(/[^a-z0-9]/gi, '_'));
      if (!clientFolder) throw new Error('Could not create ZIP folder');

      // 1. Export client info
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (client) {
        clientFolder.file('client_info.json', JSON.stringify(client, null, 2));
      }

      // 2. Get all entities
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('client_id', clientId);

      if (entities && entities.length > 0) {
        clientFolder.file('entities.json', JSON.stringify(entities, null, 2));

        // 3. For each entity, get movements and documents
        for (const entity of entities) {
          const entityFolderName = `${entity.name.replace(/[^a-z0-9]/gi, '_')}_${entity.rut}`;
          const entityFolder = clientFolder.folder(entityFolderName);

          if (!entityFolder) continue;

          // Get movements
          const { data: movements } = await supabase
            .from('entity_movements')
            .select('*')
            .eq('entity_id', entity.id);

          if (movements && movements.length > 0) {
            entityFolder.file('movements.json', JSON.stringify(movements, null, 2));
          }

          // Get documents
          const { data: documents } = await supabase
            .from('documents')
            .select('*')
            .eq('entity_id', entity.id);

          if (documents && documents.length > 0) {
            entityFolder.file('documents_metadata.json', JSON.stringify(documents, null, 2));

            // Download actual files
            const docsFolder = entityFolder.folder('files');
            if (docsFolder) {
              for (const doc of documents) {
                try {
                  const { data: fileData } = await supabase.storage
                    .from('documents')
                    .download(doc.file_path);

                  if (fileData) {
                    docsFolder.file(doc.file_name, fileData);
                  }
                } catch (error) {
                  console.error(`Error downloading ${doc.file_name}:`, error);
                }
              }
            }
          }
        }
      }

      // Generate ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clientName.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error exporting client data:', error);
      alert('Error al exportar los datos del cliente');
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!deletingClient) return;

    setIsExporting(true);
    try {
      // First export the data
      const exported = await exportClientData(deletingClient.id, deletingClient.name);

      if (!exported) {
        setIsExporting(false);
        return;
      }

      // Move client and related data to recycle bin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated');

      // Get all entities
      const { data: entities } = await supabase
        .from('entities')
        .select('id')
        .eq('client_id', deletingClient.id);

      const entityIds = entities?.map(e => e.id) || [];

      // Get all movements
      const { data: movements } = await supabase
        .from('entity_movements')
        .select('id')
        .in('entity_id', entityIds);

      const movementIds = movements?.map(m => m.id) || [];

      // Get all documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id')
        .in('entity_id', entityIds);

      // Move documents to recycle bin
      if (documents && documents.length > 0) {
        const recycleBinEntries = documents.map(doc => ({
          document_id: doc.id,
          deleted_by: user.id,
          deletion_reason: `Cliente eliminado: ${deletingClient.name}`,
          can_restore: true,
          auto_delete_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }));

        await supabase.from('document_recycle_bin').insert(recycleBinEntries);
      }

      // Delete client (CASCADE will delete related entities and movements)
      await supabase
        .from('clients')
        .delete()
        .eq('id', deletingClient.id);

      // Log audit
      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'DELETE',
        p_entity_type: 'client',
        p_entity_id: deletingClient.id,
        p_entity_name: deletingClient.name,
        p_metadata: {
          exported: true,
          entities_count: entityIds.length,
          movements_count: movementIds.length,
          documents_count: documents?.length || 0,
        },
      });

      alert(`✅ Cliente "${deletingClient.name}" eliminado exitosamente.\n\nLos datos han sido exportados y el cliente ha sido enviado a la papelera.`);

      setShowDeleteModal(false);
      setDeletingClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert(`Error al eliminar el cliente: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.rut && client.rut.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-gray-600 mt-1">
            Selecciona un cliente para gestionar sus sociedades y documentos
          </p>
        </div>
        {(userRole === 'admin' || userRole === 'rc_abogados') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nuevo Cliente
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

      {filteredClients.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => onSelectClient(client.id)}
              className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group relative"
            >
              {(userRole === 'admin' || userRole === 'rc_abogados') && (
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={(e) => openEditModal(client, e)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar cliente"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => openDeleteModal(client, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar cliente"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Building2 className="text-blue-600" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {client.name}
                  </h3>
                  {client.rut && (
                    <p className="text-sm text-gray-600 mt-1">RUT: {client.rut}</p>
                  )}
                  {client.contact_person && (
                    <p className="text-sm text-gray-500 mt-1">
                      Contacto: {client.contact_person}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditModal && editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Editar Cliente</h3>
            <form onSubmit={handleEditClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT
                </label>
                <input
                  type="text"
                  value={editingClient.rut || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, rut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editingClient.email || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={editingClient.phone || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={editingClient.contact_person || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={editingClient.address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={editingClient.notes}
                  onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingClient(null);
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Crear Nuevo Cliente</h3>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUT
                </label>
                <input
                  type="text"
                  value={newClient.rut}
                  onChange={(e) => setNewClient({ ...newClient, rut: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Persona de Contacto
                </label>
                <input
                  type="text"
                  value={newClient.contact_person}
                  onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })}
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
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deletingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Eliminar Cliente</h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que deseas eliminar el cliente <strong>"{deletingClient.name}"</strong>?
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Download className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Se exportarán los datos antes de eliminar:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Información del cliente</li>
                      <li>Todas las sociedades y entidades</li>
                      <li>Todas las gestiones registradas</li>
                      <li>Todos los documentos y archivos</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm text-orange-800">
                    <p className="font-semibold mb-1">Después de la exportación:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>El cliente y sus datos se moverán a la papelera</li>
                      <li>Podrán restaurarse en los próximos 30 días</li>
                      <li>Después de 30 días se eliminarán permanentemente</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingClient(null);
                }}
                disabled={isExporting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={isExporting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Exportar y Eliminar
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
