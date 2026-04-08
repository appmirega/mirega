import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
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
  photo_3_url: string | null;
  photo_4_url: string | null;
}

interface AdditionalObservation {
  id: string;
  observation_text: string;
  observation_order: number;
}

interface DynamicChecklistFormProps {
  checklistId: string;
  elevatorId: string;
  isHydraulic: boolean;
  month: number;
  onComplete: () => void | Promise<void>;
  onSave: () => void;
}

const EXCLUDED_PHOTO_PATTERNS = [
  'cable de suspensión',
  'cables de suspensión',
  'suspensión',
  'prueba de freno',
  'funcionamiento de freno',
  'freno',
  'pruebas de limitador',
  'prueba de limitador',
  'limitador',
  'cuñas',
  'cuña',
];

function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function questionRequiresPhotos(question: Question) {
  const q = normalizeText(question.question_text);
  return !EXCLUDED_PHOTO_PATTERNS.some((pattern) => q.includes(normalizeText(pattern)));
}

function createEmptyAdditionalObservation(order: number): AdditionalObservation {
  return {
    id: crypto.randomUUID(),
    observation_text: '',
    observation_order: order,
  };
}

export function DynamicChecklistForm({
  checklistId,
  elevatorId,
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
  const [additionalObservationsEnabled, setAdditionalObservationsEnabled] = useState(false);
  const [additionalObservations, setAdditionalObservations] = useState<AdditionalObservation[]>([]);

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
            photo_3_url: answer.photo_3_url || null,
            photo_4_url: answer.photo_4_url || null,
          });
        });

        setAnswers(answersMap);

        const { data: extraObs, error: extraObsError } = await supabase
          .from('mnt_additional_observations')
          .select('id, observation_text, observation_order')
          .eq('maintenance_id', checklistId)
          .order('observation_order', { ascending: true });

        if (extraObsError) throw extraObsError;

        const loadedAdditional = (extraObs || []).map((row: any) => ({
          id: row.id,
          observation_text: row.observation_text || '',
          observation_order: row.observation_order || 1,
        }));

        setAdditionalObservations(loadedAdditional);
        setAdditionalObservationsEnabled(loadedAdditional.length > 0);

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

    void loadData();
  }, [checklistId, month, isHydraulic]);

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

    let filtered = [...monthlyQuestions, ...trimestralQuestions, ...semestralQuestions];

    if (!isHydraulicElevator) {
      filtered = filtered.filter((q) => !q.is_hydraulic_only);
    }

    return filtered;
  };

  const getAnswer = (questionId: string): Answer | undefined => answers.get(questionId);

  const createDefaultAnswer = (questionId: string): Answer => ({
    question_id: questionId,
    status: 'pending',
    observations: '',
    photo_1_url: null,
    photo_2_url: null,
    photo_3_url: null,
    photo_4_url: null,
  });

  const handleAnswerChange = (questionId: string, status: Answer['status']) => {
    const currentAnswer = answers.get(questionId) || createDefaultAnswer(questionId);

    const newAnswer: Answer = {
      ...currentAnswer,
      status,
      observations: status === 'approved' ? '' : currentAnswer.observations,
    };

    const newMap = new Map(answers);
    newMap.set(questionId, newAnswer);
    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const handleObservationsChange = (questionId: string, observations: string) => {
    const currentAnswer = answers.get(questionId) || createDefaultAnswer(questionId);

    const newMap = new Map(answers);
    newMap.set(questionId, { ...currentAnswer, observations });
    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const handlePhotosChange = (
    questionId: string,
    photo1Url: string | null,
    photo2Url: string | null,
    photo3Url: string | null = null,
    photo4Url: string | null = null
  ) => {
    const currentAnswer = answers.get(questionId) || createDefaultAnswer(questionId);

    const newMap = new Map(answers);
    newMap.set(questionId, {
      ...currentAnswer,
      photo_1_url: photo1Url,
      photo_2_url: photo2Url,
      photo_3_url: photo3Url,
      photo_4_url: photo4Url,
    });

    setAnswers(newMap);
    setChangeCount((prev) => prev + 1);
  };

  const addAdditionalObservation = () => {
    setAdditionalObservationsEnabled(true);
    setAdditionalObservations((prev) => [
      ...prev,
      createEmptyAdditionalObservation(prev.length + 1),
    ]);
    setChangeCount((prev) => prev + 1);
  };

  const updateAdditionalObservation = (id: string, value: string) => {
    setAdditionalObservations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, observation_text: value } : item))
    );
    setChangeCount((prev) => prev + 1);
  };

  const removeAdditionalObservation = (id: string) => {
    setAdditionalObservations((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, observation_order: index + 1 }))
    );
    setChangeCount((prev) => prev + 1);
  };

  const toggleAdditionalObservations = (enabled: boolean) => {
    setAdditionalObservationsEnabled(enabled);
    if (!enabled) {
      setAdditionalObservations([]);
    } else if (additionalObservations.length === 0) {
      setAdditionalObservations([createEmptyAdditionalObservation(1)]);
    }
    setChangeCount((prev) => prev + 1);
  };

  const countPhotos = (answer?: Answer) => {
    if (!answer) return 0;
    return [
      answer.photo_1_url,
      answer.photo_2_url,
      answer.photo_3_url,
      answer.photo_4_url,
    ].filter(Boolean).length;
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

  const canComplete = () => {
    return questions.every((q) => {
      const answer = answers.get(q.id);
      if (!answer || answer.status === 'pending') return false;
      if (answer.status === 'not_applicable') return true;

      const requiresPhotos = questionRequiresPhotos(q);
      const enoughPhotos = !requiresPhotos || countPhotos(answer) >= 2;

      if (answer.status === 'rejected') {
        return answer.observations.trim() !== '' && enoughPhotos;
      }

      return enoughPhotos;
    });
  };

  const saveAnswers = async (isAutoSave = false) => {
    setSaving(true);

    try {
      const answersToSave = Array.from(answers.values()).map((answer) => ({
        checklist_id: checklistId,
        question_id: answer.question_id,
        status: answer.status,
        observations: answer.observations,
        photo_1_url: answer.photo_1_url,
        photo_2_url: answer.photo_2_url,
        photo_3_url: answer.photo_3_url,
        photo_4_url: answer.photo_4_url,
      }));

      for (const answer of answersToSave) {
        const { error } = await supabase
          .from('mnt_checklist_answers')
          .upsert(answer, {
            onConflict: 'checklist_id,question_id',
          });

        if (error) throw error;
      }

      await supabase
        .from('mnt_additional_observations')
        .delete()
        .eq('maintenance_id', checklistId);

      if (additionalObservationsEnabled) {
        const cleanAdditional = additionalObservations
          .map((item, index) => ({
            maintenance_id: checklistId,
            observation_text: item.observation_text.trim(),
            observation_order: index + 1,
          }))
          .filter((item) => item.observation_text !== '');

        if (cleanAdditional.length > 0) {
          const { error: extraError } = await supabase
            .from('mnt_additional_observations')
            .insert(cleanAdditional);

          if (extraError) throw extraError;
        }
      }

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

  const handleAutoSave = async () => {
    await saveAnswers(true);
  };

  const handleManualSave = async () => {
    await saveAnswers(false);
  };

  const handleCompleteClick = async () => {
    if (!canComplete()) {
      alert(
        'Aún hay preguntas sin responder o sin evidencia mínima. Las preguntas válidas requieren al menos 2 fotos, y las rechazadas además requieren observación.'
      );
      return;
    }

    try {
      setSaving(true);
      await saveAnswers(true);
      await onComplete();
    } catch (error) {
      console.error('Error al completar checklist:', error);
      alert('Error al completar el checklist. Por favor intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (changeCount >= 5) {
      void handleAutoSave();
    }
  }, [changeCount]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const groupedQuestions = useMemo(() => {
    return questions.reduce((groups, question) => {
      if (!groups[question.section]) {
        groups[question.section] = [];
      }
      groups[question.section].push(question);
      return groups;
    }, {} as Record<string, Question[]>);
  }, [questions]);

  const progress = getProgress();

  const formatDateTime = (date: Date) =>
    date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Checklist de Mantenimiento
          </h2>
          <p className="text-sm text-slate-600">
            Cada pregunta válida requiere entre 2 y 4 fotografías. Las respuestas rechazadas requieren observación y evidencia fotográfica.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-40 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
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
                <AlertCircle className="h-4 w-4" />
                Cambios sin guardar: {changeCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {!canComplete() && progress.answered > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">Checklist incompleto</p>
            <p className="text-sm text-amber-800">
              Debes responder todas las preguntas. Las preguntas válidas requieren al menos 2 fotos. Si la respuesta es rechazada, además debes ingresar observación.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
          <div
            key={section}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggleSection(section)}
              className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 hover:bg-slate-100"
            >
              <span className="font-semibold text-slate-800">{section}</span>
              {expandedSections.has(section) ? (
                <ChevronUp className="h-5 w-5 text-slate-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
              )}
            </button>

            {expandedSections.has(section) && (
              <div className="divide-y divide-slate-100">
                {sectionQuestions.map((question) => {
                  const answer = getAnswer(question.id);
                  const status = answer?.status ?? 'pending';
                  const requiresPhotos = questionRequiresPhotos(question);
                  const photoCount = countPhotos(answer);

                  return (
                    <div key={question.id} className="p-4 transition hover:bg-slate-50">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                            {question.question_number}
                          </span>
                          <p className="flex-1 font-medium text-slate-900">
                            {question.question_text}
                          </p>
                        </div>

                        <div className="ml-8 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            Frecuencia:{' '}
                            {question.frequency === 'M'
                              ? 'Mensual'
                              : question.frequency === 'T'
                              ? 'Trimestral'
                              : 'Semestral'}
                          </span>
                          {question.is_hydraulic_only && (
                            <span>• Solo ascensores hidráulicos</span>
                          )}
                          {!requiresPhotos && (
                            <span className="font-medium text-slate-600">
                              • Excluida del registro fotográfico
                            </span>
                          )}
                        </div>

                        <div className="ml-8 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(question.id, 'approved')}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                              status === 'approved'
                                ? 'bg-green-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:border-green-500'
                            }`}
                            title="Aprobar"
                          >
                            <Check className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAnswerChange(question.id, 'not_applicable')}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                              status === 'not_applicable'
                                ? 'bg-gray-500 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:border-gray-500'
                            }`}
                            title="No Aplica"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAnswerChange(question.id, 'rejected')}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                              status === 'rejected'
                                ? 'bg-red-600 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:border-red-500'
                            }`}
                            title="Rechazar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {status !== 'pending' && status !== 'not_applicable' && (
                          <div
                            className={`ml-8 space-y-4 rounded-lg border p-4 ${
                              status === 'rejected'
                                ? 'border-red-200 bg-red-50'
                                : 'border-blue-200 bg-blue-50'
                            }`}
                          >
                            {status === 'rejected' && (
                              <div>
                                <label className="mb-2 block text-sm font-semibold text-red-900">
                                  Observaciones (obligatorias)
                                </label>
                                <textarea
                                  value={answer?.observations || ''}
                                  onChange={(e) =>
                                    handleObservationsChange(question.id, e.target.value)
                                  }
                                  placeholder="Describe el problema encontrado..."
                                  rows={3}
                                  className="w-full rounded-lg border border-red-200 px-4 py-2 focus:border-red-500 focus:ring-2 focus:ring-red-500"
                                />
                              </div>
                            )}

                            {requiresPhotos ? (
                              <div>
                                <label
                                  className={`mb-2 block text-sm font-semibold ${
                                    status === 'rejected'
                                      ? 'text-red-900'
                                      : 'text-blue-900'
                                  }`}
                                >
                                  Evidencia fotográfica (mínimo 2 / máximo 4)
                                </label>

                                <PhotoCapture
                                  questionId={question.id}
                                  checklistId={checklistId}
                                  existingPhotos={{
                                    photo1: answer?.photo_1_url || undefined,
                                    photo2: answer?.photo_2_url || undefined,
                                    photo3: answer?.photo_3_url || undefined,
                                    photo4: answer?.photo_4_url || undefined,
                                  }}
                                  minRequired={2}
                                  maxPhotos={4}
                                  onPhotosChange={(photo1Url, photo2Url, photo3Url, photo4Url) =>
                                    handlePhotosChange(
                                      question.id,
                                      photo1Url,
                                      photo2Url,
                                      photo3Url,
                                      photo4Url
                                    )
                                  }
                                />

                                <p
                                  className={`mt-2 text-xs ${
                                    photoCount >= 2
                                      ? 'text-green-700'
                                      : status === 'rejected'
                                      ? 'text-red-700'
                                      : 'text-blue-700'
                                  }`}
                                >
                                  Fotos cargadas: {photoCount} / 4
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                                Esta pregunta no requiere registro fotográfico en esta etapa.
                              </div>
                            )}
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Observaciones adicionales</h3>
            <p className="text-sm text-slate-600">
              Registra observaciones generales que no correspondan al detalle de una pregunta puntual.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">¿Existen observaciones adicionales?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAdditionalObservations(true)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  additionalObservationsEnabled
                    ? 'bg-green-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => toggleAdditionalObservations(false)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  !additionalObservationsEnabled
                    ? 'bg-slate-700 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>

        {additionalObservationsEnabled && (
          <div className="space-y-4">
            {additionalObservations.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">Observación {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeAdditionalObservation(item.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>

                <textarea
                  value={item.observation_text}
                  onChange={(e) => updateAdditionalObservation(item.id, e.target.value)}
                  rows={3}
                  placeholder="Ej: Cables de suspensión requieren adelantar inspección visual."
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={addAdditionalObservation}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-4 w-4" />
              Agregar otra observación
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving || changeCount === 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-6 py-4 text-lg font-bold text-blue-600 transition hover:scale-[1.02] hover:bg-blue-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-6 w-6" />
            {saving ? 'Guardando...' : 'Guardar Progreso'}
          </button>

          <button
            type="button"
            onClick={handleCompleteClick}
            disabled={!canComplete() || saving}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-bold text-white shadow-lg transition ${
              canComplete() && !saving
                ? 'bg-green-600 hover:scale-[1.02] hover:bg-green-700 active:scale-[0.98]'
                : 'cursor-not-allowed bg-slate-400 opacity-60'
            }`}
          >
            <Check className="h-6 w-6" />
            {saving ? 'Guardando...' : 'Completar y Firmar'}
          </button>
        </div>
      </div>

      <div className="h-24" />
    </div>
  );
}
