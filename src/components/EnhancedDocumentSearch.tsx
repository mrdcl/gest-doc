import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FileText, X, AlertCircle, Clock, Filter, ChevronDown, Trash2 } from 'lucide-react';
import { trackSearchQuery, trackSearchRun, trackSearchResultClick } from '../lib/telemetry';
import { useQuery } from '@tanstack/react-query';

type SearchResult = {
  id: string;
  document_id: string;
  document_title: string;
  file_name: string;
  page_number: number;
  content_text: string;
  entity_id: string;
  entity_name: string;
  client_id: string;
  movement_id: string;
  movement_type_name: string;
  movement_type_code: string;
  uploaded_at: string;
};

type SearchFilter = {
  status?: string;
  category?: string;
  owner?: string;
  updatedSince?: string;
};

interface EnhancedDocumentSearchProps {
  onClose: () => void;
  onDocumentSelect: (clientId: string, entityId: string) => void;
}

// Recent searches management
const RECENT_SEARCHES_KEY = 'recent_document_searches';
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  if (!query.trim()) return;

  const recent = getRecentSearches();
  const filtered = recent.filter(q => q !== query);
  const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export default function EnhancedDocumentSearch({ onClose, onDocumentSelect }: EnhancedDocumentSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter>({});
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [shouldSearch, setShouldSearch] = useState(false);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch search results with TanStack Query
  const {
    data: results = [],
    isLoading: searching,
    error,
    refetch
  } = useQuery({
    queryKey: ['documentSearch', searchQuery, filters],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];

      const searchStartTime = Date.now();
      trackSearchQuery(searchQuery);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: userClients } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id);

      const clientIds = userClients?.map(uc => uc.client_id) || [];
      if (clientIds.length === 0) return [];

      let query = supabase
        .from('document_search_results')
        .select('*')
        .in('client_id', clientIds)
        .textSearch('content_text', searchQuery, {
          type: 'websearch',
          config: 'spanish',
        })
        .limit(50);

      // Apply filters
      if (filters.status) {
        query = query.eq('document_status', filters.status);
      }
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.owner) {
        query = query.ilike('owner_email', `%${filters.owner}%`);
      }
      if (filters.updatedSince) {
        const date = new Date();
        if (filters.updatedSince === '7days') {
          date.setDate(date.getDate() - 7);
        } else if (filters.updatedSince === '30days') {
          date.setDate(date.getDate() - 30);
        } else if (filters.updatedSince === '90days') {
          date.setDate(date.getDate() - 90);
        }
        query = query.gte('uploaded_at', date.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const searchDuration = Date.now() - searchStartTime;
      trackSearchRun(searchQuery, (data || []).length, searchDuration);

      // Add to recent searches
      addRecentSearch(searchQuery);
      setRecentSearches(getRecentSearches());

      return data || [];
    },
    enabled: shouldSearch && searchQuery.trim().length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShouldSearch(true);
    refetch();
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
    setShouldSearch(true);
    setTimeout(() => refetch(), 0);
  };

  const clearFilters = () => {
    setFilters({});
  };

  const activeFiltersCount = Object.keys(filters).filter(key => filters[key as keyof SearchFilter]).length;

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
    if (words.length === 0) return text;

    let highlighted = text;
    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    });

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  };

  const getContextSnippet = (text: string, query: string, maxLength: number = 200) => {
    if (!query || !text) return text.substring(0, maxLength) + '...';

    const lowerQuery = query.toLowerCase().split(' ')[0];
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text.substring(0, maxLength) + '...';

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + maxLength - 50);
    const snippet = text.substring(start, end);

    return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Search className="text-blue-600" size={24} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Búsqueda Avanzada</h2>
              <p className="text-sm text-gray-500">Busca documentos con filtros inteligentes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en documentos..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                autoFocus
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Filter size={20} />
                {activeFiltersCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown size={16} className={showFilters ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Filtros</h3>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <select
                      value={filters.status || ''}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="draft">Borrador</option>
                      <option value="active">Activo</option>
                      <option value="archived">Archivado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Actualizado</label>
                    <select
                      value={filters.updatedSince || ''}
                      onChange={(e) => setFilters({ ...filters, updatedSince: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Cualquier fecha</option>
                      <option value="7days">Últimos 7 días</option>
                      <option value="30days">Últimos 30 días</option>
                      <option value="90days">Últimos 90 días</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Propietario (email)</label>
                    <input
                      type="text"
                      value={filters.owner || ''}
                      onChange={(e) => setFilters({ ...filters, owner: e.target.value || undefined })}
                      placeholder="Buscar por email..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Recent Searches */}
          {!shouldSearch && recentSearches.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} />
                  <span className="font-medium">Búsquedas recientes</span>
                </div>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Limpiar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecentSearchClick(query)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {searching && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Buscando en documentos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-semibold text-red-900">Error en la búsqueda</h4>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error ? error.message : 'Error desconocido'}
                </p>
              </div>
            </div>
          )}

          {!searching && shouldSearch && results.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron resultados</h3>
              <p className="text-gray-600">
                Intenta con otros términos de búsqueda o ajusta los filtros
              </p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Se encontraron {results.length} resultado{results.length !== 1 ? 's' : ''}
              </p>

              {results.map((result, index) => (
                <div
                  key={result.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer"
                  onClick={() => {
                    trackSearchResultClick(searchQuery, result.document_id, index);
                    if (result.client_id && result.entity_id) {
                      onDocumentSelect(result.client_id, result.entity_id);
                      onClose();
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {highlightText(result.document_title, searchQuery)}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {result.file_name} {result.page_number > 0 && `• Página ${result.page_number}`}
                      </p>
                      <p className="text-sm text-gray-700 mb-2">
                        {highlightText(getContextSnippet(result.content_text, searchQuery), searchQuery)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {result.entity_name}
                        </span>
                        {result.movement_type_name && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {result.movement_type_name}
                          </span>
                        )}
                        <span className="text-gray-500">
                          {new Date(result.uploaded_at).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
