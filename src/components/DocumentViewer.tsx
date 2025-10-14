import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import { supabase } from '../lib/supabase';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  documentId: string;
  fileName: string;
  filePath: string;
  onClose: () => void;
  searchTerm?: string;
}

export default function DocumentViewer({
  documentId,
  fileName,
  filePath,
  onClose,
  searchTerm = '',
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');

  const isPDF = fileName.toLowerCase().endsWith('.pdf');

  const loadDocument = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        setFileUrl(data.signedUrl);
      }

      await logDocumentView();
    } catch (error: any) {
      console.error('Error loading document:', error);
      setError('Error al cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  const logDocumentView = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabase.rpc('log_audit_action', {
        p_user_id: user.id,
        p_user_email: user.email || '',
        p_action: 'VIEW',
        p_entity_type: 'document',
        p_entity_id: documentId,
        p_entity_name: fileName,
        p_metadata: {
          source: 'document_viewer',
          user_name: profile?.full_name || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error logging document view:', error);
    }
  };

  useEffect(() => {
    loadDocument();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset;
      return Math.min(Math.max(1, newPage), numPages);
    });
  };

  const changeScale = (delta: number) => {
    setScale((prevScale) => {
      const newScale = prevScale + delta;
      return Math.min(Math.max(0.5, newScale), 3.0);
    });
  };

  const downloadDocument = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('log_audit_action', {
          p_user_id: user.id,
          p_user_email: user.email || '',
          p_action: 'DOWNLOAD',
          p_entity_type: 'document',
          p_entity_id: documentId,
          p_entity_name: fileName,
          p_metadata: { source: 'document_viewer' }
        });
      }
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert('Error al descargar el documento');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (loading) {
    return (
      <div className={`fixed inset-0 bg-black ${isFullscreen ? 'z-50' : 'bg-opacity-75 z-50'} flex items-center justify-center`}>
        <div className="bg-white rounded-lg p-6">
          <div className="text-gray-600">Cargando documento...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 ${isFullscreen ? 'z-50' : 'z-50'} bg-black ${isFullscreen ? '' : 'bg-opacity-90'} flex flex-col`}>
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h3 className="font-semibold truncate">{fileName}</h3>
          {isPDF && numPages > 0 && (
            <span className="text-sm text-gray-400">
              Página {pageNumber} de {numPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPDF && (
            <>
              <button
                onClick={() => changePage(-1)}
                disabled={pageNumber <= 1}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Página anterior"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="text-sm px-3 py-1 bg-gray-800 rounded">
                <input
                  type="number"
                  value={pageNumber}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= numPages) {
                      setPageNumber(page);
                    }
                  }}
                  className="w-12 bg-transparent text-center outline-none"
                  min="1"
                  max={numPages}
                />
              </div>

              <button
                onClick={() => changePage(1)}
                disabled={pageNumber >= numPages}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Página siguiente"
              >
                <ChevronRight size={20} />
              </button>

              <div className="w-px h-6 bg-gray-700 mx-2" />

              <button
                onClick={() => changeScale(-0.25)}
                disabled={scale <= 0.5}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Alejar"
              >
                <ZoomOut size={20} />
              </button>

              <span className="text-sm px-2">{Math.round(scale * 100)}%</span>

              <button
                onClick={() => changeScale(0.25)}
                disabled={scale >= 3.0}
                className="p-2 hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Acercar"
              >
                <ZoomIn size={20} />
              </button>

              <div className="w-px h-6 bg-gray-700 mx-2" />
            </>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-700 rounded"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          <button
            onClick={downloadDocument}
            className="p-2 hover:bg-gray-700 rounded"
            title="Descargar"
          >
            <Download size={20} />
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-800 flex items-center justify-center p-4">
        {isPDF ? (
          <div className="bg-white shadow-2xl">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-12">
                  <div className="text-gray-600">Cargando PDF...</div>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-12">
                  <div className="text-red-600">Error al cargar el PDF</div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        ) : (
          <div className="max-w-4xl w-full bg-white rounded-lg shadow-2xl overflow-hidden">
            {fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img
                src={fileUrl}
                alt={fileName}
                className="w-full h-auto"
                style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
              />
            ) : (
              <div className="p-12 text-center">
                <p className="text-gray-600 mb-4">
                  Vista previa no disponible para este tipo de archivo
                </p>
                <button
                  onClick={downloadDocument}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <Download size={20} />
                  Descargar archivo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {searchTerm && isPDF && (
        <div className="absolute top-20 right-4 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm text-yellow-800">
            <strong>Búsqueda:</strong> {searchTerm}
          </p>
        </div>
      )}
    </div>
  );
}
