import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, FileText, Users, Activity, Download, Eye, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type Metrics = {
  totalDocuments: number;
  totalUsers: number;
  totalViews: number;
  totalDownloads: number;
  totalUploads: number;
  documentsThisMonth: number;
  documentsThisWeek: number;
  activeUsers: number;
  storageUsed: number;
  categoriesCount: number;
};

type RecentActivity = {
  id: string;
  action: string;
  user_email: string;
  entity_name: string;
  created_at: string;
};

export default function MetricsDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    fetchMetrics();
    fetchRecentActivity();
  }, [timeRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Total documents
      const { count: totalDocuments } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // Total users
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Total categories
      const { count: categoriesCount } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      // Audit logs for views and downloads
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select('action')
        .in('action', ['view', 'download', 'upload']);

      const totalViews = auditData?.filter(a => a.action === 'view').length || 0;
      const totalDownloads = auditData?.filter(a => a.action === 'download').length || 0;
      const totalUploads = auditData?.filter(a => a.action === 'upload').length || 0;

      // Documents this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: documentsThisMonth } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      // Documents this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const { count: documentsThisWeek } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfWeek.toISOString());

      // Active users (logged in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: activeUsers } = await supabase
        .from('user_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_activity', sevenDaysAgo.toISOString());

      // Storage used (sum of file sizes)
      const { data: docsData } = await supabase
        .from('documents')
        .select('file_size');

      const storageUsed = docsData?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) || 0;

      setMetrics({
        totalDocuments: totalDocuments || 0,
        totalUsers: totalUsers || 0,
        totalViews,
        totalDownloads,
        totalUploads,
        documentsThisMonth: documentsThisMonth || 0,
        documentsThisWeek: documentsThisWeek || 0,
        activeUsers: activeUsers || 0,
        storageUsed,
        categoriesCount: categoriesCount || 0,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs_detailed')
        .select('id, action, user_email, entity_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getActionName = (action: string) => {
    const actions: { [key: string]: string } = {
      'view': 'Vio',
      'download': 'Descargó',
      'upload': 'Subió',
      'edit': 'Editó',
      'delete': 'Eliminó',
      'share': 'Compartió',
      'CREATE': 'Creó',
      'UPDATE': 'Actualizó',
      'DELETE': 'Eliminó',
    };
    return actions[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-blue-600" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard de Métricas</h2>
            <p className="text-sm text-gray-500">Estadísticas del sistema en tiempo real</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mes
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Documents */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <FileText className="text-blue-600" size={24} />
            <span className="text-xs text-gray-500 uppercase font-semibold">Total</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalDocuments}</div>
          <div className="text-sm text-gray-600">Documentos</div>
          <div className="mt-2 text-xs text-blue-600">
            +{metrics.documentsThisMonth} este mes
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-green-600" size={24} />
            <span className="text-xs text-gray-500 uppercase font-semibold">Usuarios</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalUsers}</div>
          <div className="text-sm text-gray-600">Total usuarios</div>
          <div className="mt-2 text-xs text-green-600">
            {metrics.activeUsers} activos (7d)
          </div>
        </div>

        {/* Total Views */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <Eye className="text-purple-600" size={24} />
            <span className="text-xs text-gray-500 uppercase font-semibold">Vistas</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalViews}</div>
          <div className="text-sm text-gray-600">Visualizaciones</div>
          <div className="mt-2 text-xs text-purple-600">
            {metrics.totalDownloads} descargas
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <Activity className="text-orange-600" size={24} />
            <span className="text-xs text-gray-500 uppercase font-semibold">Storage</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {formatBytes(metrics.storageUsed)}
          </div>
          <div className="text-sm text-gray-600">Espacio usado</div>
          <div className="mt-2 text-xs text-orange-600">
            {metrics.categoriesCount} categorías
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={20} />
            Tendencia de Uploads
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Esta semana</span>
                <span className="text-sm font-semibold">{metrics.documentsThisWeek}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${(metrics.documentsThisWeek / Math.max(metrics.documentsThisMonth, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Este mes</span>
                <span className="text-sm font-semibold">{metrics.documentsThisMonth}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${(metrics.documentsThisMonth / Math.max(metrics.totalDocuments, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-sm font-semibold">{metrics.totalDocuments}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="text-green-600" size={20} />
            Actividad del Sistema
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="text-blue-600" size={20} />
                <span className="text-sm text-gray-700">Uploads</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{metrics.totalUploads}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="text-purple-600" size={20} />
                <span className="text-sm text-gray-700">Visualizaciones</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{metrics.totalViews}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="text-green-600" size={20} />
                <span className="text-sm text-gray-700">Descargas</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{metrics.totalDownloads}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="text-orange-600" size={20} />
                <span className="text-sm text-gray-700">Usuarios activos (7d)</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{metrics.activeUsers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-600" size={20} />
            Actividad Reciente
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentActivity.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hay actividad reciente
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user_email}</span>
                      {' '}
                      {getActionName(activity.action)}
                      {' '}
                      <span className="font-medium">{activity.entity_name || 'un recurso'}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.created_at).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                    {getActionName(activity.action)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
