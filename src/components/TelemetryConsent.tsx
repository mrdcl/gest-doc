import { useState, useEffect } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { enableTelemetry, disableTelemetry, isTelemetryEnabled } from '../lib/telemetry';

export default function TelemetryConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const hasConsent = localStorage.getItem('telemetry_consent');

    if (hasConsent === null) {
      // Show banner if user hasn't decided yet
      setShowBanner(true);
    } else {
      setTelemetryEnabled(isTelemetryEnabled());
    }
  }, []);

  const handleAccept = () => {
    enableTelemetry();
    setTelemetryEnabled(true);
    setShowBanner(false);
  };

  const handleDecline = () => {
    disableTelemetry();
    setTelemetryEnabled(false);
    setShowBanner(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t-2 border-blue-600 shadow-2xl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-blue-600" size={24} />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ayúdanos a mejorar tu experiencia
            </h3>
            <p className="text-gray-600 mb-4">
              Nos gustaría recopilar datos anónimos de uso para entender cómo usas la aplicación
              y mejorar tu experiencia. Los datos recopilados incluyen:
            </p>
            <ul className="text-sm text-gray-600 mb-4 ml-6 list-disc space-y-1">
              <li>Páginas visitadas y acciones realizadas</li>
              <li>Tiempo que tardas en completar tareas comunes</li>
              <li>Errores técnicos que encuentres</li>
              <li>Búsquedas y resultados (sin contenido sensible)</li>
            </ul>
            <p className="text-sm text-gray-500 mb-4">
              No recopilamos información personal identificable ni contenido de documentos.
              Puedes cambiar tu preferencia en cualquier momento desde la configuración.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAccept}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Aceptar y ayudar a mejorar
              </button>
              <button
                onClick={handleDecline}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
              >
                No, gracias
              </button>
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 text-blue-600 hover:text-blue-700 font-medium flex items-center"
              >
                Más información sobre privacidad
              </a>
            </div>
          </div>

          <button
            onClick={handleDecline}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
