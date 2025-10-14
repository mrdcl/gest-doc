import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { X, Upload, FileText, Plus, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import { trackDocUploadStart, trackDocUploadSuccess, trackDocUploadFail, trackFirstValueAchieved, trackUserActivated } from '../lib/telemetry';

interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface EnhancedUploadModalProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EnhancedUploadModal({ categories, onClose, onSuccess }: EnhancedUploadModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'review' | 'share'>('upload');

  // Upload step
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Review step
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);

  // Share step
  const [shareWithUsers, setShareWithUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string; full_name: string }>>([]);

  const [error, setError] = useState('');
  const [documentId, setDocumentId] = useState<string>('');

  // Smart defaults: remember last used category
  useEffect(() => {
    const lastCategory = localStorage.getItem('last_used_category');
    if (lastCategory && categories.find(c => c.id === lastCategory)) {
      setCategoryId(lastCategory);
    }
  }, [categories]);

  useEffect(() => {
    if (step === 'share') {
      fetchUsers();
    }
  }, [step]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('is_active', true)
        .neq('id', user?.id)
        .order('full_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        // Smart default: use filename without extension
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('No authenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: newCategoryName,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update categories list
      categories.push(data);
      setCategoryId(data.id);
      setNewCategoryName('');
      setShowNewCategory(false);

      alert('✅ Categoría creada exitosamente');
    } catch (error: any) {
      console.error('Error creating category:', error);
      alert(`Error al crear categoría: ${error.message}`);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setError('');
    setUploadProgress(0);

    const uploadStartTime = Date.now();
    const signupTime = new Date(user.created_at || Date.now()).getTime();

    trackDocUploadStart(file.name, file.size);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          title,
          description,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          category_id: categoryId || null,
          status,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setDocumentId(documentData.id);

      // Save last used category
      if (categoryId) {
        localStorage.setItem('last_used_category', categoryId);
      }

      const uploadDuration = Date.now() - uploadStartTime;
      trackDocUploadSuccess(documentData.id, file.name, file.size, uploadDuration);

      // Check for first value / activation
      const timeSinceSignup = Date.now() - signupTime;
      const hoursSinceSignup = timeSinceSignup / (1000 * 60 * 60);

      if (hoursSinceSignup < 1) {
        // First doc in first hour - track TTFV
        trackFirstValueAchieved(timeSinceSignup);
      }

      if (hoursSinceSignup < 24) {
        // First doc in 24 hours - track activation
        trackUserActivated(timeSinceSignup);
      }

      // Move to share step
      setStep('share');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      const errorMessage = error.message || 'Error al subir el documento';
      setError(errorMessage);
      trackDocUploadFail(file.name, errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    if (shareWithUsers.length === 0) {
      // Skip sharing, just close
      onSuccess();
      onClose();
      return;
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('No authenticated');

      const shares = shareWithUsers.map(userId => ({
        document_id: documentId,
        shared_with_user_id: userId,
        shared_by_user_id: currentUser.id,
        permission: 'read' as const,
      }));

      const { error } = await supabase
        .from('document_shares')
        .insert(shares);

      if (error) throw error;

      alert(`✅ Documento compartido con ${shareWithUsers.length} usuario(s)`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error sharing document:', error);
      alert(`Error al compartir: ${error.message}`);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'upload':
        return 'Subir Documento';
      case 'review':
        return 'Revisar Información';
      case 'share':
        return 'Compartir (Opcional)';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'upload':
        return 'Selecciona el archivo que deseas subir';
      case 'review':
        return 'Completa los detalles del documento';
      case 'share':
        return 'Comparte el documento con otros usuarios';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Upload className="text-blue-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{getStepTitle()}</h2>
                <p className="text-sm text-gray-500">{getStepDescription()}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {['upload', 'review', 'share'].map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex-1 h-2 rounded-full ${
                  step === s ? 'bg-blue-600' :
                  ['upload', 'review', 'share'].indexOf(step) > idx ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {file ? file.name : 'Selecciona un archivo'}
                </p>
                <p className="text-sm text-gray-500">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'o arrastra y suelta aquí'}
                </p>
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </div>

              {file && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="text-green-600" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Archivo seleccionado</p>
                    <p className="text-sm text-green-700">{file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título del Documento *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Contrato de Arrendamiento 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción opcional del documento..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Categoría
                  </label>
                  <button
                    onClick={() => setShowNewCategory(!showNewCategory)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Nueva categoría
                  </button>
                </div>

                {showNewCategory ? (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre de la nueva categoría..."
                    />
                    <button
                      onClick={handleCreateCategory}
                      disabled={creatingCategory || !newCategoryName.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Crear
                    </button>
                    <button
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}

                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {categoryId && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ Esta categoría se recordará para próximas subidas
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="draft"
                      checked={status === 'draft'}
                      onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Borrador</span>
                    <span className="text-xs text-gray-500">(recomendado)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="active"
                      checked={status === 'active'}
                      onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Activo</span>
                  </label>
                </div>
              </div>

              {uploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Subiendo...</span>
                    <span className="text-sm text-gray-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Share */}
          {step === 'share' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Share2 className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Documento subido exitosamente</h4>
                    <p className="text-sm text-blue-700">
                      Puedes compartirlo ahora o hacerlo más tarde desde la lista de documentos
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compartir con usuarios (opcional)
                </label>
                <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                  {availableUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={shareWithUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setShareWithUsers([...shareWithUsers, u.id]);
                          } else {
                            setShareWithUsers(shareWithUsers.filter(id => id !== u.id));
                          }
                        }}
                        className="text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{u.full_name}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {shareWithUsers.length > 0 && (
                  <p className="text-sm text-blue-600 mt-2">
                    Se compartirá con {shareWithUsers.length} usuario(s)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between">
          <button
            onClick={() => {
              if (step === 'upload') {
                onClose();
              } else if (step === 'review') {
                setStep('upload');
              } else if (step === 'share') {
                setStep('review');
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {step === 'upload' ? 'Cancelar' : 'Atrás'}
          </button>

          <button
            onClick={() => {
              if (step === 'upload' && file) {
                setStep('review');
              } else if (step === 'review') {
                handleUpload();
              } else if (step === 'share') {
                handleShare();
              }
            }}
            disabled={
              (step === 'upload' && !file) ||
              (step === 'review' && (!title.trim() || uploading))
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'upload' && 'Continuar'}
            {step === 'review' && (uploading ? 'Subiendo...' : 'Subir Documento')}
            {step === 'share' && (shareWithUsers.length > 0 ? 'Compartir y Finalizar' : 'Omitir y Finalizar')}
          </button>
        </div>
      </div>
    </div>
  );
}
