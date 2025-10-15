import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Edit,
  Upload,
  Archive,
  Clock,
  User,
  MessageSquare,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface DocumentWorkflowProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
  onStateChange?: () => void;
}

interface WorkflowState {
  id: string;
  document_id: string;
  current_state: string;
  previous_state: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowTransition {
  id: string;
  from_state: string;
  to_state: string;
  transitioned_by: string;
  transition_type: string;
  comment: string | null;
  created_at: string;
  transitioned_by_email: string;
  hours_since_last_transition: number | null;
}

const STATE_CONFIG = {
  draft: {
    label: 'Borrador',
    color: 'gray',
    icon: Edit,
    description: 'Documento en preparación',
  },
  in_review: {
    label: 'En Revisión',
    color: 'blue',
    icon: FileText,
    description: 'Documento bajo revisión',
  },
  approved: {
    label: 'Aprobado',
    color: 'green',
    icon: CheckCircle,
    description: 'Documento aprobado',
  },
  rejected: {
    label: 'Rechazado',
    color: 'red',
    icon: XCircle,
    description: 'Documento rechazado, requiere cambios',
  },
  published: {
    label: 'Publicado',
    color: 'purple',
    icon: Upload,
    description: 'Documento publicado',
  },
  archived: {
    label: 'Archivado',
    color: 'gray',
    icon: Archive,
    description: 'Documento archivado',
  },
};

const TRANSITION_CONFIG = {
  draft: {
    actions: [
      { type: 'submit', label: 'Enviar a Revisión', nextState: 'in_review', color: 'blue' },
    ],
  },
  in_review: {
    actions: [
      { type: 'approve', label: 'Aprobar', nextState: 'approved', color: 'green' },
      { type: 'reject', label: 'Rechazar', nextState: 'rejected', color: 'red' },
    ],
  },
  rejected: {
    actions: [
      { type: 'revise', label: 'Revisar y Reenviar', nextState: 'draft', color: 'blue' },
    ],
  },
  approved: {
    actions: [
      { type: 'publish', label: 'Publicar', nextState: 'published', color: 'purple' },
    ],
  },
  published: {
    actions: [
      { type: 'archive', label: 'Archivar', nextState: 'archived', color: 'gray' },
    ],
  },
  archived: {
    actions: [],
  },
};

export default function DocumentWorkflow({
  documentId,
  documentName,
  onClose,
  onStateChange,
}: DocumentWorkflowProps) {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [comment, setComment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);

  useEffect(() => {
    fetchWorkflowData();
    fetchUsers();
  }, [documentId]);

  const fetchWorkflowData = async () => {
    try {
      const { data: stateData, error: stateError } = await supabase
        .from('document_workflow_states')
        .select('*')
        .eq('document_id', documentId)
        .maybeSingle();

      if (stateError) throw stateError;

      if (!stateData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: newState, error: createError } = await supabase
          .from('document_workflow_states')
          .insert({
            document_id: documentId,
            current_state: 'draft',
          })
          .select()
          .single();

        if (createError) throw createError;
        setWorkflowState(newState);
      } else {
        setWorkflowState(stateData);
      }

      const { data: transitionsData, error: transitionsError } = await supabase
        .from('workflow_transition_history')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (transitionsError) throw transitionsError;
      setTransitions(transitionsData || []);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, email');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleTransition = async (transitionType: string, nextState: string) => {
    if (!workflowState) return;

    const requiresComment = ['reject', 'revise'].includes(transitionType);
    if (requiresComment && !comment.trim()) {
      alert('Por favor ingresa un comentario para esta acción');
      return;
    }

    const confirmMessage = `¿Confirmar transición a "${STATE_CONFIG[nextState as keyof typeof STATE_CONFIG].label}"?`;
    if (!confirm(confirmMessage)) return;

    setTransitioning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('transition_workflow_state', {
        p_document_id: documentId,
        p_to_state: nextState,
        p_transition_type: transitionType,
        p_user_id: user.id,
        p_comment: comment || null,
        p_assigned_to: assignedTo || null,
        p_due_date: dueDate || null,
      });

      if (error) throw error;

      const result = data[0];
      if (!result.success) {
        alert(`Error: ${result.error_message}`);
        return;
      }

      setComment('');
      setAssignedTo('');
      setDueDate('');
      await fetchWorkflowData();

      if (onStateChange) {
        onStateChange();
      }

      alert(`✅ Estado actualizado a "${STATE_CONFIG[nextState as keyof typeof STATE_CONFIG].label}"`);
    } catch (error: any) {
      console.error('Error transitioning workflow:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setTransitioning(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return '';
    if (hours < 1) return `${Math.round(hours * 60)} minutos`;
    if (hours < 24) return `${Math.round(hours)} horas`;
    return `${Math.round(hours / 24)} días`;
  };

  const getTimeRemaining = (dueDateString: string) => {
    const now = new Date();
    const dueDate = new Date(dueDateString);
    const diff = dueDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return { text: 'Vencido', color: 'text-red-600', isOverdue: true };
    if (days === 0) return { text: `${hours}h restantes`, color: 'text-orange-600', isOverdue: false };
    if (days === 1) return { text: '1 día restante', color: 'text-yellow-600', isOverdue: false };
    return { text: `${days} días restantes`, color: 'text-blue-600', isOverdue: false };
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Cargando workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflowState) {
    return null;
  }

  const currentStateConfig = STATE_CONFIG[workflowState.current_state as keyof typeof STATE_CONFIG];
  const StateIcon = currentStateConfig.icon;
  const availableActions = TRANSITION_CONFIG[workflowState.current_state as keyof typeof TRANSITION_CONFIG]?.actions || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Workflow de Aprobación</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Documento: <span className="font-medium">{documentName}</span>
          </p>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-${currentStateConfig.color}-100`}>
            <StateIcon className={`w-5 h-5 text-${currentStateConfig.color}-600`} />
            <div>
              <div className={`font-semibold text-${currentStateConfig.color}-900`}>
                {currentStateConfig.label}
              </div>
              <div className={`text-sm text-${currentStateConfig.color}-700`}>
                {currentStateConfig.description}
              </div>
            </div>
          </div>

          {workflowState.due_date && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span className="text-gray-600">Vencimiento:</span>
              <span className={getTimeRemaining(workflowState.due_date).color}>
                {formatDate(workflowState.due_date)} ({getTimeRemaining(workflowState.due_date).text})
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {availableActions.length > 0 && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Acciones Disponibles</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Comentario (opcional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Agregar comentario sobre esta transición..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {workflowState.current_state === 'draft' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <User className="w-4 h-4 inline mr-1" />
                        Asignar a (opcional)
                      </label>
                      <select
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Sin asignar</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Fecha límite (opcional)
                      </label>
                      <input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {availableActions.map((action) => (
                    <button
                      key={action.type}
                      onClick={() => handleTransition(action.type, action.nextState)}
                      disabled={transitioning}
                      className={`flex-1 px-4 py-2 bg-${action.color}-600 text-white rounded-lg hover:bg-${action.color}-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium`}
                    >
                      {transitioning ? 'Procesando...' : action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Historial de Transiciones</h3>

            {transitions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No hay transiciones registradas aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transitions.map((transition, index) => {
                  const fromConfig = STATE_CONFIG[transition.from_state as keyof typeof STATE_CONFIG];
                  const toConfig = STATE_CONFIG[transition.to_state as keyof typeof STATE_CONFIG];
                  const FromIcon = fromConfig.icon;
                  const ToIcon = toConfig.icon;

                  return (
                    <div
                      key={transition.id}
                      className="border border-gray-200 rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-${fromConfig.color}-100`}>
                            <FromIcon className={`w-4 h-4 text-${fromConfig.color}-600`} />
                          </div>
                          <span className="text-gray-400">→</span>
                          <div className={`p-2 rounded-lg bg-${toConfig.color}-100`}>
                            <ToIcon className={`w-4 h-4 text-${toConfig.color}-600`} />
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900">
                              {fromConfig.label} → {toConfig.label}
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDate(transition.created_at)}
                            </span>
                          </div>

                          <div className="text-sm text-gray-600 mb-1">
                            Por: <span className="font-medium">{transition.transitioned_by_email}</span>
                            {transition.hours_since_last_transition !== null && index < transitions.length - 1 && (
                              <span className="ml-2 text-gray-500">
                                (después de {formatDuration(transition.hours_since_last_transition)})
                              </span>
                            )}
                          </div>

                          {transition.comment && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                              <MessageSquare className="w-3 h-3 inline mr-1" />
                              {transition.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          <p>
            <strong>Nota:</strong> Todas las transiciones de workflow son auditadas y no pueden ser revertidas.
          </p>
        </div>
      </div>
    </div>
  );
}
