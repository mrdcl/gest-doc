import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { reprocessAllDocuments } from '../lib/ocrService';

interface OCRReprocessorProps {
  onClose: () => void;
}

export default function OCRReprocessor({ onClose }: OCRReprocessorProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleReprocess = async () => {
    if (processing) return;

    const confirmed = confirm(
      '¿Estás seguro de que deseas reprocesar TODOS los documentos?\n\n' +
      'Esta operación puede tardar varios minutos dependiendo de la cantidad de documentos.\n\n' +
      'Los documentos se procesarán uno por uno para extraer su contenido mediante OCR.'
    );

    if (!confirmed) return;

    setProcessing(true);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setCompleted(false);

    try {
      const results = await reprocessAllDocuments((current, total) => {
        setProgress({ current, total });
      });

      setResult(results);
      setCompleted(true);
    } catch (error) {
      console.error('Error reprocessing:', error);
      alert('Error al reprocesar documentos. Ver consola para detalles.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <RefreshCw className="text-blue-600" size={28} />
            <h2 className="text-2xl font-bold text-gray-900">Reprocesar Documentos OCR</h2>
          </div>
        </div>

        <div className="space-y-4">
          {!processing && !completed && (
            <>
              <p className="text-gray-700">
                Esta herramienta reprocesará todos los documentos PDF e imágenes en la base de datos
                para extraer su contenido mediante OCR (Reconocimiento Óptico de Caracteres).
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Advertencia:</strong> Esta operación puede tardar varios minutos.
                  Los documentos se procesarán de forma secuencial.
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReprocess}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Iniciar Reprocesamiento
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}

          {processing && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <RefreshCw className="animate-spin mx-auto text-blue-600 mb-4" size={48} />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Procesando documentos...
                </p>
                <p className="text-gray-600">
                  {progress.current} de {progress.total} documentos
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: progress.total > 0
                        ? `${(progress.current / progress.total) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                Por favor, no cierres esta ventana hasta que el proceso termine
              </p>
            </div>
          )}

          {completed && result && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <CheckCircle className="mx-auto text-green-600 mb-4" size={64} />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Reprocesamiento Completado
                </h3>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="text-gray-700">Documentos procesados exitosamente:</span>
                  </div>
                  <span className="font-bold text-green-600">{result.success}</span>
                </div>

                {result.failed > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="text-red-600" size={20} />
                      <span className="text-gray-700">Documentos con errores:</span>
                    </div>
                    <span className="font-bold text-red-600">{result.failed}</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 text-center">
                Los documentos procesados ahora están disponibles para búsqueda de contenido
              </p>

              <button
                onClick={onClose}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
