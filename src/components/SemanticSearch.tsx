import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Brain, FileText, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface SearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
  metadata: any;
}

interface DocumentChunkStats {
  document_id: string;
  document_name: string;
  chunk_count: number;
  total_chars: number;
  total_tokens: number;
  embedded_chunks: number;
  embedding_percentage: number;
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<DocumentChunkStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);

  const checkOllamaAvailability = async () => {
    try {
      const ollamaUrl = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: 'GET',
      });
      setOllamaAvailable(response.ok);
    } catch (error) {
      setOllamaAvailable(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('document_chunk_stats')
        .select('*')
        .order('chunk_count', { ascending: false })
        .limit(10);

      if (error) throw error;
      setStats(data || []);
      setShowStats(true);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      alert(`Error al cargar estadísticas: ${error.message}`);
    }
  };

  const performSemanticSearch = async () => {
    if (!query.trim()) {
      alert('Por favor ingresa una consulta');
      return;
    }

    if (ollamaAvailable === null) {
      await checkOllamaAvailability();
    }

    if (!ollamaAvailable) {
      alert('❌ Ollama no está disponible. Se requiere un servidor Ollama configurado para búsqueda semántica.\n\nVer IMPLEMENTACION_P5.md para instrucciones de instalación.');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      // 1. Generate embedding using Ollama
      const ollamaUrl = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
      const embeddingResponse = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: query,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error('Error generando embedding');
      }

      const { embedding } = await embeddingResponse.json();

      // 2. Search similar chunks in database
      const { data, error } = await supabase.rpc('search_similar_chunks', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 10,
      });

      if (error) throw error;

      setResults(data || []);

      if (data?.length === 0) {
        alert('No se encontraron resultados similares');
      }
    } catch (error: any) {
      console.error('Error in semantic search:', error);
      alert(`❌ Error: ${error.message}\n\nAsegúrate de que Ollama esté corriendo y el modelo nomic-embed-text esté instalado.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Búsqueda Semántica</h1>
            <p className="text-gray-600">Encuentra documentos por significado, no solo palabras clave</p>
          </div>
        </div>

        {ollamaAvailable === false && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Ollama no disponible</h3>
                <p className="text-sm text-yellow-800 mb-2">
                  La búsqueda semántica requiere un servidor Ollama configurado.
                  La base de datos ya está preparada con pgvector.
                </p>
                <p className="text-xs text-yellow-700">
                  Ver <code className="bg-yellow-100 px-1 py-0.5 rounded">IMPLEMENTACION_P5.md</code> para instrucciones de instalación.
                </p>
              </div>
            </div>
          </div>
        )}

        {ollamaAvailable === true && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-800">
              <strong>Ollama conectado.</strong> Búsqueda semántica habilitada.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSemanticSearch()}
                  placeholder="Ej: contratos de arriendo en Santiago, facturas de enero, informes financieros..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              onClick={performSemanticSearch}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  Buscar
                </>
              )}
            </button>
          </div>

          <button
            onClick={loadStats}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <FileText className="w-4 h-4" />
            {showStats ? 'Ocultar estadísticas' : 'Ver estadísticas de chunks'}
          </button>
        </div>
      </div>

      {showStats && stats.length > 0 && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Estadísticas de Embeddings</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-3 font-semibold text-gray-700">Documento</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">Chunks</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">Caracteres</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">Tokens</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">Con Embedding</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat) => (
                  <tr key={stat.document_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-gray-900">{stat.document_name || 'Sin nombre'}</td>
                    <td className="py-3 text-gray-600 text-right">{stat.chunk_count}</td>
                    <td className="py-3 text-gray-600 text-right">{stat.total_chars?.toLocaleString()}</td>
                    <td className="py-3 text-gray-600 text-right">{stat.total_tokens?.toLocaleString()}</td>
                    <td className="py-3 text-gray-600 text-right">{stat.embedded_chunks}</td>
                    <td className="py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        stat.embedding_percentage === 100
                          ? 'bg-green-100 text-green-800'
                          : stat.embedding_percentage > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {stat.embedding_percentage?.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Resultados ({results.length})
          </h2>

          {results.map((result, index) => (
            <div
              key={result.chunk_id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-semibold text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Documento ID: {result.document_id.substring(0, 8)}...</h3>
                    <p className="text-sm text-gray-600">Chunk ID: {result.chunk_id.substring(0, 8)}...</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">
                    {(result.similarity * 100).toFixed(1)}% similar
                  </div>
                  <div className="text-xs text-gray-500">
                    Similitud coseno
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-800 leading-relaxed">{result.content}</p>
              </div>

              {result.metadata && Object.keys(result.metadata).length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {Object.entries(result.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      <strong className="mr-1">{key}:</strong> {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <div className="text-center py-12 text-gray-500">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>Realiza una búsqueda para ver resultados</p>
        </div>
      )}
    </div>
  );
}
