import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Download, Filter, Search, X, Calendar, User, FileText } from 'lucide-react';

type AuditLogEntry = {
  id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  old_value: any;
  new_value: any;
  metadata: any;
  created_at: string;
};

interface AuditLogProps {
  onBack: () => void;
}

export default function AuditLog({ onBack }: AuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterEntityType, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs_detailed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterAction) {
        query = query.eq('action', filterAction);
      }

      if (filterEntityType) {
        query = query.eq('entity_type', filterEntityType);
      }

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDateTime.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      alert('Error al cargar logs de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Email', 'Rol', 'Acción', 'Tipo', 'Entidad', 'Detalles'];
    const csvData = logs.map(log => [
      new Date(log.created_at).toLocaleString('es-CL'),
      log.user_name || 'N/A',
      log.user_email,
      getRoleName(log.user_role),
      getActionName(log.action),
      getEntityTypeName(log.entity_type),
      log.entity_name || 'N/A',
      JSON.stringify(log.metadata || {})
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getActionName = (action: string) => {
    const actions: { [key: string]: string } = {
      'view': 'Ver',
      'download': 'Descargar',
      'edit': 'Editar',
      'delete': 'Eliminar',
      'share': 'Compartir',
      'upload': 'Subir',
      'CREATE': 'Crear',
      'UPDATE': 'Actualizar',
      'DELETE': 'Eliminar',
      'LOGIN': 'Iniciar Sesión',
      'LOGOUT': 'Cerrar Sesión'
    };
    return actions[action] || action;
  };

  const getEntityTypeName = (type: string) => {
    const types: { [key: string]: string } = {
      'document': 'Documento',
      'user': 'Usuario',
      'client': 'Cliente',
      'entity': 'Sociedad',
      'movement': 'Gestión'
    };
    return types[type] || type;
  };

  const getRoleName = (role: string) => {
    const roles: { [key: string]: string } = {
      'admin': 'Administrador',
      'rc_abogados': 'RC Abogados',
      'cliente': 'Cliente',
      'user': 'Usuario'
    };
    return roles[role] || role;
  };

  const getActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      'view': 'bg-blue-100 text-blue-700',
      'download': 'bg-green-100 text-green-700',
      'edit': 'bg-yellow-100 text-yellow-700',
      'UPDATE': 'bg-yellow-100 text-yellow-700',
      'delete': 'bg-red-100 text-red-700',
      'DELETE': 'bg-red-100 text-red-700',
      'upload': 'bg-purple-100 text-purple-700',
      'CREATE': 'bg-green-100 text-green-700',
      'share': 'bg-indigo-100 text-indigo-700',
      'LOGIN': 'bg-teal-100 text-teal-700',
      'LOGOUT': 'bg-gray-100 text-gray-700'
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower)
    );
  });

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueEntityTypes = Array.from(new Set(logs.map(log => log.entity_type).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando logs de auditoría...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Registro de Auditoría</h1>
              <p className="text-sm text-gray-500">Historial completo de acciones del sistema</p>
            </div>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download size={20} />
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search size={16} className="inline mr-1" />
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Usuario, email, entidad, acción..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter size={16} className="inline mr-1" />
              Acción
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{getActionName(action)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={16} className="inline mr-1" />
              Tipo
            </label>
            <select
              value={filterEntityType}
              onChange={(e) => setFilterEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {uniqueEntityTypes.map(type => (
                <option key={type} value={type}>{getEntityTypeName(type)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Hasta
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {(searchTerm || filterAction || filterEntityType || startDate || endDate) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">Filtros activos:</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterAction('');
                setFilterEntityType('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X size={14} />
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha y Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entidad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Detalles
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron registros de auditoría
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString('es-CL')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.user_name || 'Usuario Desconocido'}
                          </div>
                          <div className="text-xs text-gray-500">{log.user_email}</div>
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            {getRoleName(log.user_role)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(log.action)}`}>
                        {getActionName(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.entity_type ? getEntityTypeName(log.entity_type) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.entity_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600">
            Mostrando {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Detalles del Registro</h2>
              <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
                <div className="text-gray-900">{new Date(selectedLog.created_at).toLocaleString('es-CL')}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <div className="text-gray-900">{selectedLog.user_name || 'Usuario Desconocido'}</div>
                <div className="text-sm text-gray-500">{selectedLog.user_email}</div>
                <span className="inline-block mt-1 px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                  {getRoleName(selectedLog.user_role)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acción</label>
                <span className={`px-2 py-1 text-sm font-medium rounded ${getActionColor(selectedLog.action)}`}>
                  {getActionName(selectedLog.action)}
                </span>
              </div>

              {selectedLog.entity_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Entidad</label>
                  <div className="text-gray-900">{getEntityTypeName(selectedLog.entity_type)}</div>
                </div>
              )}

              {selectedLog.entity_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entidad Afectada</label>
                  <div className="text-gray-900">{selectedLog.entity_name}</div>
                </div>
              )}

              {selectedLog.old_value && Object.keys(selectedLog.old_value).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Anterior</label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_value && Object.keys(selectedLog.new_value).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Nuevo</label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metadatos</label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
