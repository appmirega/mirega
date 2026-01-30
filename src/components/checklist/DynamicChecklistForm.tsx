import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, Minus, ChevronDown, ChevronUp, AlertCircle, Save } from 'lucide-react';
import PhotoCapture from './PhotoCapture';

interface Question {
  id: string;
  question_number: number;
  section: string;
  question_text: string;
  frequency: 'M' | 'T' | 'S';
  is_hydraulic_only: boolean;
}

interface Answer {
  question_id: string;
  status: 'approved' | 'rejected' | 'not_applicable' | 'pending';
  observations: string;
  photo_1_url: string | null;
  photo_2_url: string | null;
}

interface DynamicChecklistFormProps {
  checklistId: string;
  elevatorId: string;
  isHydraulic: boolean;
  month: number;
  onComplete: () => void;
  onSave: () => void;
}

export function DynamicChecklistForm({
  checklistId,
  elevatorId, // reservado para futuros usos
  isHydraulic,
  month,
  onComplete,
  onSave,
}: DynamicChecklistFormProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Cargar preguntas y respuestas
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: questionsData, error: questionsError } = await supabase
          .from('mnt_checklist_questions')
          .select('*')
          .order('question_number');

        if (questionsError) throw questionsError;

        const filteredQuestions = filterQuestionsByFrequency(
          (questionsData || []) as Question[],
          month,
          isHydraulic
        );
        setQuestions(filteredQuestions);

        const { data: answersData, error: answersError } = await supabase
          .from('mnt_checklist_answers')
          .select('*')
          .eq('checklist_id', checklistId);

        if (answersError) throw answersError;

        const answersMap = new Map<string, Answer>();
        (answersData || []).forEach((answer: any) => {
          answersMap.set(answer.question_id, {
            question_id: answer.question_id,
            status: answer.status as Answer['status'],
            observations: answer.observations || '',
            photo_1_url: answer.photo_1_url,
            photo_2_url: answer.photo_2_url,
          });
        });

        setAnswers(answersMap);

        const sections = new Set<string>();
        filteredQuestions.forEach((q) => sections.add(q.section));
        setExpandedSections(sections);
      } catch (error) {
        console.error('Error loading checklist data:', error);
        alert('Error al cargar el checklist');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [checklistId, month, isHydraulic]);

  // Filtrar preguntas por frecuencia y tipo de ascensor
  const filterQuestionsByFrequency = (
    allQuestions: Question[],
    currentMonth: number,
    isHydraulicElevator: boolean
  ): Question[] => {
    const monthlyQuestions = allQuestions.filter((q) => q.frequency === 'M');

    let trimestralQuestions: Question[] = [];
    let semestralQuestions: Question[] = [];

    if (currentMonth % 3 === 0) {
      trimestralQuestions = allQuestions.filter((q) => q.frequency === 'T');
    }

    if (currentMonth % 6 === 0) {
      semestralQuestions = allQuestions.filter((q) => q.frequency === 'S');
    }

    let filtered = [
      ...monthlyQuestions,
      ...trimestralQuestions,
      ...semestralQuestions,
    ];

    if (!isHydraulicElevator) {
      filtered = filtered.filter((q) => !q.is_hydraulic_only);
    }

    return filtered;
  };

  const getAnswer = (questionId: string): Answer | undefined => {
    return answers.get(questionId);
  };

  const handleAnswerChange = (questionId: string, status: Answer['status']) => {
    const currentAnswer = answers.get(questionId) || {
      question_id: questionId,
      status: 'pending' as Answer['status'],
      observations: '',
      photo_1_url: null,
      photo_2_url: null,
    };

    const newAnswer: Answer = {
      ...currentAnswer,
      status,
      observations: status === 'approved' ? '' : currentAnswer.observations,
      photo_1_url: status === 'approved' ? null : currentAnswer.photo_1_url,
      photo_2_url: status === 'approved' ? null : currentAnswer.photo_2_url,
    };

    const newMap = new Map(answers);
    newMap.set(questionId, newAnswer);
    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const handleObservationsChange = (questionId: string, observations: string) => {
    const currentAnswer = answers.get(questionId);
    if (!currentAnswer) return;

    const newMap = new Map(answers);
    newMap.set(questionId, { ...currentAnswer, observations });
    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const handlePhotosChange = (
    questionId: string,
    photo1Url: string | null,
    photo2Url: string | null
  ) => {
    const currentAnswer = answers.get(questionId);
    if (!currentAnswer) return;

    const newMap = new Map(answers);
    newMap.set(questionId, { ...currentAnswer, photo_1_url: photo1Url, photo_2_url: photo2Url });
    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const handleAutoSave = async () => {
    await saveAnswers(true);
  };

  const handleManualSave = async () => {
    await saveAnswers(false);
  };

  const saveAnswers = async (isAutoSave: boolean = false) => {
    setSaving(true);
    try {
      const answersToSave = Array.from(answers.values()).map((answer) => ({
        checklist_id: checklistId,
        question_id: answer.question_id,
        status: answer.status,
        observations: answer.observations,
        photo_1_url: answer.photo_1_url,
        photo_2_url: answer.photo_2_url,
      }));

      for (const answer of answersToSave) {
        const { error } = await supabase
          .from('mnt_checklist_answers')
          .upsert(answer, {
            onConflict: 'checklist_id,question_id',
          });

        if (error) throw error;
      }

      // Auto-guardado: marcamos que el checklist se actualizó
      if (isAutoSave) {
        const { error: updateError } = await supabase
          .from('mnt_checklists')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', checklistId);

        if (updateError) {
          console.error('Error updating checklist on autosave:', updateError);
        }
      }

      setLastSaved(new Date());
      setChangeCount(0);

      if (!isAutoSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving answers:', error);
      alert('Error al guardar las respuestas');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getProgress = () => {
    const total = questions.length;
    let answered = 0;

    questions.forEach((q) => {
      const answer = answers.get(q.id);
      if (answer && answer.status !== 'pending') {
        answered++;
      }
    });

    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  };

  // Todas las rechazadas deben tener observación + al menos 1 foto
  const canComplete = () => {
    const allAnswered = questions.every((q) => {
      const answer = answers.get(q.id);
      if (!answer || answer.status === 'pending') return false;

      if (answer.status === 'rejected') {
        return (
          answer.observations.trim() !== '' &&
          !!answer.photo_1_url
        );
      }

      return true;
    });

    return allAnswered;
  };

  const handleCompleteClick = async () => {
    console.log('🔴 handleCompleteClick INICIADO');
    console.log('canComplete():', canComplete());
    
    if (!canComplete()) {
      alert('Aún hay preguntas sin responder o sin observaciones/fotos donde corresponde.');
      return;
    }

    console.log('typeof onComplete:', typeof onComplete);
    if (typeof onComplete !== 'function') {
      console.error('onComplete no es una función válida');
      alert('Error: La función onComplete no está disponible');
      return;
    }

    try {
      setSaving(true);
      console.log('Guardando respuestas...');
      
      // Guardar respuestas directamente sin llamar a onSave
      const answersToSave = Array.from(answers.values()).map((answer) => ({
        checklist_id: checklistId,
        question_id: answer.question_id,
        status: answer.status,
        observations: answer.observations,
        photo_1_url: answer.photo_1_url,
        photo_2_url: answer.photo_2_url,
      }));

      console.log('Guardando', answersToSave.length, 'respuestas...');

      for (const answer of answersToSave) {
        const { error } = await supabase
          .from('mnt_checklist_answers')
          .upsert(answer, {
            onConflict: 'checklist_id,question_id',
          });

        if (error) {
          console.log('❌ Error guardando respuesta:', error);
          throw error;
        }
      }
      
      console.log('✅ Todas las respuestas guardadas');
      console.log('🟢 Llamando a onComplete()...');
      
      // Llamar a onComplete para cerrar y volver a selección de ascensores
      await onComplete();
      
      console.log('✅ onComplete() ejecutado, finalizando...');
      
      // Forzar re-render limpiando estado local
      setSaving(false);
      
    } catch (error) {
      console.error('Error al completar checklist:', error);
      alert('Error al completar el checklist. Por favor intenta de nuevo.');
      setSaving(false);
    }
  };

  useEffect(() => {
    if (changeCount >= 5) {
      handleAutoSave();
    }
  }, [changeCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const progress = getProgress();

  const groupedQuestions = questions.reduce((groups, question) => {
    if (!groups[question.section]) {
      groups[question.section] = [];
    }
    groups[question.section].push(question);
    return groups;
  }, {} as Record<string, Question[]>);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header de Progreso */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Checklist de Mantenimiento
          </h2>
          <p className="text-sm text-slate-600">
            Responde todas las preguntas. Las respuestas rechazadas requieren observaciones y al menos 1 foto.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="w-40 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {progress.answered} / {progress.total} respondidas ({progress.percentage}%)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {lastSaved && (
              <span>
                Último guardado: <span className="font-medium">{formatDateTime(lastSaved)}</span>
              </span>
            )}
            {changeCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                Cambios sin guardar: {changeCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje de validación si falta algo */}
      {!canComplete() && progress.answered > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Checklist Incompleto</p>
            <p className="text-sm text-amber-800">
              Todas las preguntas rechazadas deben incluir observaciones y al menos 1 fotografía.
            </p>
          </div>
        </div>
      )}

      {/* Secciones del checklist */}
      <div className="space-y-4 pb-32">
        {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
          <div key={section} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection(section)}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100"
            >
              <span className="font-semibold text-slate-800">{section}</span>
              {expandedSections.has(section) ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>

            {expandedSections.has(section) && (
              <div className="divide-y divide-slate-100">
                {sectionQuestions.map((question) => {
                  const answer = getAnswer(question.id);
                  const status = answer?.status ?? 'pending';

                  return (
                    <div key={question.id} className="p-4 hover:bg-slate-50 transition">
                      <div className="space-y-2">
                        {/* Número + Pregunta en la misma línea */}
                        <div className="flex items-start gap-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0 mt-0.5">
                            {question.question_number}
                          </span>
                          <p className="font-medium text-slate-900 flex-1">
                            {question.question_text}
                          </p>
                        </div>

                        {/* Frecuencia debajo */}
                        <p className="text-xs text-slate-500 ml-8">
                          Frecuencia:{' '}
                          {question.frequency === 'M'
                            ? 'Mensual'
                            : question.frequency === 'T'
                            ? 'Trimestral'
                            : 'Semestral'}
                          {question.is_hydraulic_only && ' • Solo ascensores hidráulicos'}
                        </p>

                        {/* Botones de respuesta debajo - más pequeños */}
                        <div className="flex gap-2 ml-8">
                          <button
                            onClick={() => handleAnswerChange(question.id, 'approved')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                              status === 'approved'
                                ? 'bg-green-600 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:border-green-500'
                            }`}
                            title="Aprobar"
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleAnswerChange(question.id, 'not_applicable')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                              status === 'not_applicable'
                                ? 'bg-gray-500 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:border-gray-500'
                            }`}
                            title="No Aplica (Manual)"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleAnswerChange(question.id, 'rejected')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                              status === 'rejected'
                                ? 'bg-red-600 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:border-red-500'
                            }`}
                            title="Rechazar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Observaciones y fotos para respuestas rechazadas */}
                        {status === 'rejected' && (
                          <div className="ml-8 space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div>
                              <label className="block text-sm font-semibold text-red-900 mb-2">
                                Observaciones (Obligatorias)
                              </label>
                              <textarea
                                value={answer?.observations || ''}
                                onChange={(e) =>
                                  handleObservationsChange(question.id, e.target.value)
                                }
                                placeholder="Describe el problema encontrado..."
                                rows={3}
                                className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-red-900 mb-2">
                                Evidencia Fotográfica (mínimo 1 foto)
                              </label>
                              <PhotoCapture
                                questionId={question.id}
                                checklistId={checklistId}
                                existingPhotos={{
                                  photo1: answer?.photo_1_url || undefined,
                                  photo2: answer?.photo_2_url || undefined,
                                }}
                                onPhotosChange={(photo1Url, photo2Url) =>
                                  handlePhotosChange(question.id, photo1Url, photo2Url)
                                }
                              />
                              <p className="mt-2 text-xs text-red-700">
                                • Foto 1 es obligatoria cuando la respuesta es Rechazado. Foto 2 es opcional.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón flotante para guardar y completar checklist */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-200 shadow-2xl p-4 z-40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleManualSave}
            disabled={saving || changeCount === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-lg font-bold
                       border-2 border-blue-600 bg-white hover:bg-blue-50 text-blue-600
                       disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="w-6 h-6" />
            {saving ? 'Guardando...' : 'Guardar Progreso'}
          </button>

          <button
            onClick={handleCompleteClick}
            disabled={!canComplete() || saving}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-lg font-bold
                       text-white shadow-lg transition transform ${
                         canComplete() && !saving
                           ? 'bg-green-600 hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]'
                           : 'bg-slate-400 cursor-not-allowed opacity-60'
                       }`}
          >
            <Check className="w-6 h-6" />
            {saving ? 'Guardando...' : 'Completar y Firmar'}
          </button>
        </div>
      </div>

      {/* Espaciador para evitar que el contenido quede oculto bajo la barra flotante */}
      <div className="h-24"></div>
    </div>
  );
}
