// src/components/checklist/DynamicChecklistForm.tsx

import React, { useMemo } from 'react';
import PhotoCapture from './PhotoCapture';

const SPECIAL_QUESTIONS = [9, 14, 15, 17, 31, 32, 33];

export default function DynamicChecklistForm({
  questions,
  answers,
  onAnswerChange,
  elevatorType,
  onGoToTest,
  onPostponeTest
}) {

  // 🔧 FILTRO POR TIPO DE ASCENSOR
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (elevatorType === 'electromechanical') {
        return q.section !== 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS';
      }
      if (elevatorType === 'hydraulic') {
        return true;
      }
      return true;
    });
  }, [questions, elevatorType]);

  // 🔧 ORDEN CORRECTO
  const orderedQuestions = useMemo(() => {
    return [...filteredQuestions].sort(
      (a, b) => a.question_number - b.question_number
    );
  }, [filteredQuestions]);

  return (
    <div>
      {orderedQuestions.map((q) => {
        const answer = answers[q.id] || {};

        const isSpecial = SPECIAL_QUESTIONS.includes(q.question_number);

        return (
          <div key={q.id} className="border rounded-lg p-4 mb-4">

            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center">
                {q.question_number}
              </div>

              <div>
                <h4 className="font-semibold">{q.question_text}</h4>
                <p className="text-sm text-gray-500">
                  Frecuencia: {q.frequency}
                </p>
              </div>
            </div>

            {/* RESPUESTAS */}
            <div className="flex gap-2 mt-2">
              <button onClick={() => onAnswerChange(q.id, 'approved')}>
                ✔
              </button>
              <button onClick={() => onAnswerChange(q.id, 'not_applicable')}>
                –
              </button>
              <button onClick={() => onAnswerChange(q.id, 'rejected')}>
                ✖
              </button>
            </div>

            {/* 🔴 PREGUNTAS ESPECIALES */}
            {isSpecial ? (
              <div className="mt-4 p-3 bg-yellow-50 border rounded">

                <p className="text-sm mb-2">
                  Esta pregunta requiere una prueba específica.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => onGoToTest(q)}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Ir a prueba
                  </button>

                  <button
                    onClick={() => onPostponeTest(q)}
                    className="bg-gray-500 text-white px-3 py-1 rounded"
                  >
                    Posponer prueba
                  </button>
                </div>

              </div>
            ) : (
              // 🟢 PREGUNTAS NORMALES → FOTOS
              <PhotoCapture
                questionId={q.id}
                checklistId={q.checklist_id}
                existingPhotos={answer.photos}
                onPhotosChange={(p1, p2, p3, p4) =>
                  onAnswerChange(q.id, answer.status, {
                    photo_1_url: p1,
                    photo_2_url: p2,
                    photo_3_url: p3,
                    photo_4_url: p4,
                  })
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}