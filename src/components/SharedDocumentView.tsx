import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, AlertCircle, Lock, Clock } from 'lucide-react';
import DocumentViewer from './DocumentViewer';

interface SharedDocumentViewProps {
  token: string;
}

interface Document {
  id: string;
  title: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
}

export default function SharedDocumentView({ token }: SharedDocumentViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [permissions, setPermissions] = useState<{ read: boolean; download: boolean } | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    validateAndLoadDocument();
  }, [token]);

  const validateAndLoadDocument = async () => {
    try {
      const { data, error } = await supabase
        .rpc('validate_shared_link', { p_token: token });

      if (error) throw error;

      if (!data || data.length === 0) {
        setError('Enlace no válido');
        setLoading(false);
        return;
      }

      const result = data[0];

      if (!result.valid) {
        setError(result.error_message || 'Enlace no válido');
        setLoading(false);
        return;
      }

      setPermissions(result.permissions);

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', result.document_id)
        .single();

      if (docError) throw docError;

      setDocument(docData);

      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(docData.file_path, 3600);

      if (urlData) {
        setFileUrl(urlData.signedUrl);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error validating link:', error);
      setError(error.message || 'Error al cargar el documento');
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document || !permissions?.download || !fileUrl) return;

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.title;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando documento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {error.includes('expirado') ? (
              <Clock className="w-8 h-8 text-red-600" />
            ) : (
              <Lock className="w-8 h-8 text-red-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-600 mx-auto mb-2" />
            <p className="text-sm text-red-800">
              {error.includes('expirado')
                ? 'Este enlace ha expirado. Solicita un nuevo enlace al propietario del documento.'
                : 'Este enlace no es válido o ha sido desactivado. Verifica el enlace o contacta al propietario del documento.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!document || !fileUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No se pudo cargar el documento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                  <span>{formatFileSize(document.file_size)}</span>
                  <span>•</span>
                  <span>Subido: {formatDate(document.created_at)}</span>
                </div>
              </div>
            </div>

            {permissions?.download && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
            )}
          </div>

          {!permissions?.download && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-yellow-800">
                Este enlace es solo de lectura. La descarga no está permitida.
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <DocumentViewer
            documentId={document.id}
            fileUrl={fileUrl}
            fileType={document.mime_type}
            fileName={document.title}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Documento compartido de forma segura</p>
          <p className="text-blue-700">
            Este documento ha sido compartido mediante un enlace temporal y seguro.
            El acceso está registrado y el enlace puede expirar en cualquier momento.
          </p>
        </div>
      </div>
    </div>
  );
}
