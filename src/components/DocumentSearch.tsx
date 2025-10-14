import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, FileText, X, AlertCircle } from 'lucide-react';
import { trackSearchQuery, trackSearchRun, trackSearchResultClick } from '../lib/telemetry';

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

interface DocumentSearchProps {
  onClose: () => void;
  onDocumentSelect: (clientId: string, entityId: string) => void;
}

export default function DocumentSearch({ onClose, onDocumentSelect }: DocumentSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    trackSearchQuery(searchQuery);
    const searchStartTime = Date.now();

    setSearching(true);
    setSearched(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userClients } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id);

      const clientIds = userClients?.map(uc => uc.client_id) || [];

      if (clientIds.length === 0) {
        setResults([]);
        setSearching(false);
        return;
      }

      const { data, error } = await supabase
        .from('document_search_results')
        .select('*')
        .in('client_id', clientIds)
        .textSearch('content_text', searchQuery, {
          type: 'websearch',
          config: 'spanish',
        })
        .limit(50);

      if (error) throw error;

      const searchDuration = Date.now() - searchStartTime;
      setResults(data || []);
      trackSearchRun(searchQuery, (data || []).length, searchDuration);
    } catch (error) {
      console.error('Error searching documents:', error);
      alert('Error al buscar en los documentos');
    } finally {
      setSearching(false);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
    let highlightedText = text;

    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
    });

    return highlightedText;
  };

  const getContextSnippet = (text: string, query: string, maxLength: number = 200) => {
    if (!text) return '';

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().split(' ')[0];
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
      return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + maxLength - 50);

    let snippet = text.substring(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Búsqueda de Contenido</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Buscar en el contenido de los documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          <p className="text-sm text-gray-500 mt-2">
            Busca palabras o frases dentro del contenido extraído de los documentos mediante OCR
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {searching && (
            <div className="text-center py-12">
              <div className="text-gray-500">Buscando en los documentos...</div>
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">No se encontraron resultados</p>
              <p className="text-sm text-gray-500 mt-2">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}

          {!searching && !searched && (
            <div className="text-center py-12">
              <Search className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">
                Ingresa un término de búsqueda para encontrar documentos
              </p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-4">
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
                        {result.document_title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {result.entity_name} • {result.movement_type_name || 'Sin clasificar'} • Página {result.page_number}
                      </p>
                      <div
                        className="text-sm text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(
                            getContextSnippet(result.content_text, searchQuery),
                            searchQuery
                          ),
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {result.file_name} • Subido el {new Date(result.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Nota: Esta funcionalidad requiere que los documentos hayan sido procesados con OCR.
            Los documentos nuevos se procesarán automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
