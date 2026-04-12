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
  text: string;
}

interface DynamicChecklistFormProps {
  checklistId: string;
  elevatorId: string;
  isHydraulic: boolean;
  month: number;
  onComplete: () => void | Promise<void>;
  onSave: () => void;
}

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function filterQuestionsByFrequency(
  allQuestions: Question[],
  currentMonth: number,
  isHydraulicElevator: boolean
): Question[] {
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

  return filtered.sort((a, b) => a.question_number - b.question_number);
}

function createDefaultAnswer(questionId: string): Answer {
  return {
    question_id: questionId,
    status: 'pending',
    observations: '',
    photo_1_url: null,
    photo_2_url: null,
    photo_3_url: null,
    photo_4_url: null,
  };
}

function countPhotos(answer?: Answer) {
  if (!answer) return 0;
  return [
    answer.photo_1_url,
    answer.photo_2_url,
    answer.photo_3_url,
    answer.photo_4_url,
  ].filter(Boolean).length;
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
  const [hasAdditionalObservations, setHasAdditionalObservations] = useState(false);
  const [additionalObservations, setAdditionalObservations] = useState<AdditionalObservation[]>([
    { id: createLocalId(), text: '' },
  ]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const { data: questionsData, error: questionsError } = await supabase
          .from('mnt_checklist_questions')
          .select('*')
          .order('question_number', { ascending: true });

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
            status: (answer.status || 'pending') as Answer['status'],
            observations: answer.observations || '',
            photo_1_url: answer.photo_1_url || null,
            photo_2_url: answer.photo_2_url || null,
            photo_3_url: answer.photo_3_url || null,
            photo_4_url: answer.photo_4_url || null,
          });
        });
        setAnswers(answersMap);

        const sections = new Set<string>();
        filteredQuestions.forEach((q) => sections.add(q.section));
        setExpandedSections(sections);

        const { data: additionalData, error: additionalError } = await supabase
          .from('mnt_additional_observations')
          .select('id, observation_order, observation_text')
          .eq('maintenance_id', checklistId)
          .order('observation_order', { ascending: true });

        if (additionalError) throw additionalError;

        if (additionalData && additionalData.length > 0) {
          setHasAdditionalObservations(true);
          setAdditionalObservations(
            additionalData.map((item: any) => ({
              id: item.id || createLocalId(),
              text: item.observation_text || '',
            }))
          );
        } else {
          setHasAdditionalObservations(false);
          setAdditionalObservations([{ id: createLocalId(), text: '' }]);
        }
      } catch (error) {
        console.error('Error loading checklist data:', error);
        alert('Error al cargar el checklist');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [checklistId, month, isHydraulic, elevatorId]);

  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    questions.forEach((question) => {
      if (!groups[question.section]) groups[question.section] = [];
      groups[question.section].push(question);
    });

    Object.keys(groups).forEach((section) => {
      groups[section].sort((a, b) => a.question_number - b.question_number);
    });

    return groups;
  }, [questions]);

  const getAnswer = (questionId: string): Answer | undefined => answers.get(questionId);

  const handleAnswerChange = (questionId: string, status: Answer['status']) => {
    const currentAnswer = answers.get(questionId) || createDefaultAnswer(questionId);

    const updated: Answer = {
      ...currentAnswer,
      status,
      observations: status === 'approved' || status === 'not_applicable' ? '' : currentAnswer.observations,
    };

    const next = new Map(answers);
    next.set(questionId, updated);
    setAnswers(next);
    setChangeCount((prev) => prev + 1);
  };

  const handleObservationsChange = (questionId: string, observations: string) => {
    const currentAnswer = answers.get(questionId) || createDefaultAnswer(questionId);
    const next = new Map(answers);
    next.set(questionId, { ...currentAnswer, observations });
    setAnswers(next);
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

    const next = new Map(answers);
    next.set(questionId, {
      ...currentAnswer,
      photo_1_url: photo1Url,
      photo_2_url: photo2Url,
      photo_3_url: photo3Url,
      photo_4_url: photo4Url,
    });

    setAnswers(next);
    setChangeCount((prev) => prev + 1);
  };

  const addAdditionalObservation = () => {
    setAdditionalObservations((prev) => [...prev, { id: createLocalId(), text: '' }]);
    setChangeCount((prev) => prev + 1);
  };

  const removeAdditionalObservation = (id: string) => {
    setAdditionalObservations((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [{ id: createLocalId(), text: '' }];
    });
    setChangeCount((prev) => prev + 1);
  };

  const updateAdditionalObservation = (id: string, text: string) => {
    setAdditionalObservations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text } : item))
    );
    setChangeCount((prev) => prev + 1);
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

      const enoughPhotos = countPhotos(answer) >= 2;

      if (answer.status === 'rejected') {
        return answer.observations.trim() !== '' && enoughPhotos;
      }

      return enoughPhotos;
    });
  };

  const saveAdditionalObservations = async () => {
    await supabase.from('mnt_additional_observations').delete().eq('maintenance_id', checklistId);

    if (!hasAdditionalObservations) return;

    const cleanItems = additionalObservations
      .map((item, index) => ({
        maintenance_id: checklistId,
        observation_order: index + 1,
        observation_text: item.text.trim(),
      }))
      .filter((item) => item.observation_text);

    if (cleanItems.length === 0) return;

    const { error } = await supabase.from('mnt_additional_observations').insert(cleanItems);
    if (error) throw error;
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
        const { error } = await supabase.from('mnt_checklist_answers').upsert(answer, {
          onConflict: 'checklist_id,question_id',
        });
        if (error) throw error;
      }

      await saveAdditionalObservations();

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

  useEffect(() => {
    if (changeCount >= 5) {
      void saveAnswers(true);
    }
  }, [changeCount]);

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

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    setExpandedSections(next);
  };

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
          <h2 className="text-lg font-semibold text-slate-900">Checklist de Mantenimiento</h2>
          <p className="text-sm text-slate-600">
            Cada pregunta válida requiere entre 2 y 4 fotografías. Las preguntas rechazadas requieren observación y evidencia fotográfica.
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

      <div className="space-y-4 pb-32">
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

                            <div>
                              <label
                                className={`mb-2 block text-sm font-semibold ${
                                  status === 'rejected' ? 'text-red-900' : 'text-blue-900'
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

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Observaciones adicionales</h3>
              <p className="text-sm text-slate-600">
                Permite registrar observaciones generales fuera de las preguntas del checklist.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasAdditionalObservations(true);
                  setChangeCount((prev) => prev + 1);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  hasAdditionalObservations
                    ? 'bg-green-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                Sí
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasAdditionalObservations(false);
                  setAdditionalObservations([{ id: createLocalId(), text: '' }]);
                  setChangeCount((prev) => prev + 1);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  !hasAdditionalObservations
                    ? 'bg-gray-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {hasAdditionalObservations && (
            <div className="space-y-3">
              {additionalObservations.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Observación {index + 1}
                    </span>

                    {additionalObservations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAdditionalObservation(item.id)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <textarea
                    value={item.text}
                    onChange={(e) => updateAdditionalObservation(item.id, e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Escribe la observación adicional..."
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={addAdditionalObservation}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Agregar observación
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-slate-200 bg-white p-4 shadow-2xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-6 py-4 text-lg font-bold text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-6 w-6" />
            {saving ? 'Guardando...' : 'Guardar progreso'}
          </button>

          <button
            type="button"
            onClick={handleCompleteClick}
            disabled={!canComplete() || saving}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-bold text-white shadow-lg transition ${
              canComplete() && !saving
                ? 'bg-green-600 hover:bg-green-700'
                : 'cursor-not-allowed bg-slate-400 opacity-60'
            }`}
          >
            <Check className="h-6 w-6" />
            {saving ? 'Guardando...' : 'Completar y firmar'}
          </button>
        </div>
      </div>

      <div className="h-24" />
    </div>
  );
}

export default DynamicChecklistForm;
