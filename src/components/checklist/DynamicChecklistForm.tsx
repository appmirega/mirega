import React, { useState } from 'react'

interface Question {
  id: string
  number: number
  text: string
  section: string
}

interface Props {
  questions: Question[]
  onSubmit: (data: any) => void
}

const SPECIAL_QUESTIONS = {
  9: 'brakes',
  14: 'limiter',
  15: 'limiter',
  17: 'limiter',
  31: 'cables',
  32: 'cables',
  33: 'cables',
}

export default function DynamicChecklistForm({ questions, onSubmit }: Props) {
  const [responses, setResponses] = useState<any>({})
  const [postponeReason, setPostponeReason] = useState<string>('')

  const handleResponse = (id: string, value: string) => {
    setResponses((prev: any) => ({
      ...prev,
      [id]: {
        ...prev[id],
        status: value,
      },
    }))
  }

  const handlePostpone = (id: string) => {
    const reason = prompt('Ingrese motivo de postergación')
    if (!reason) return

    setResponses((prev: any) => ({
      ...prev,
      [id]: {
        status: 'postponed',
        reason,
      },
    }))
  }

  const handleGoToTest = (type: string) => {
    alert('Vista de prueba no operativa aún')
  }

  return (
    <div>
      {questions.map((q) => {
        const specialType = SPECIAL_QUESTIONS[q.number]

        return (
          <div key={q.id} style={{ border: '1px solid #ddd', marginBottom: 10, padding: 10 }}>
            <p><b>{q.number}. {q.text}</b></p>

            {!specialType && (
              <>
                <button onClick={() => handleResponse(q.id, 'approved')}>OK</button>
                <button onClick={() => handleResponse(q.id, 'rejected')}>Observación</button>
              </>
            )}

            {specialType && (
              <>
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => handleGoToTest(specialType)}>
                    Ir a prueba
                  </button>

                  <button onClick={() => handlePostpone(q.id)} style={{ marginLeft: 10 }}>
                    Posponer prueba
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}

      <button onClick={() => onSubmit(responses)}>Guardar</button>
    </div>
  )
}