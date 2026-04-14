export type ChecklistFrequency = 'M' | 'T' | 'S';
export type ElevatorKind = 'hydraulic' | 'electromechanical';
export type SpecialTestGroup = 'brakes' | 'limiter' | 'cables';

export interface ChecklistQuestionRule {
  id: string;
  question_number: number;
  section: string;
  question_text: string;
  frequency: ChecklistFrequency;
  is_hydraulic_only: boolean;
}

const SPECIAL_TEST_GROUPS: Record<number, SpecialTestGroup> = {
  9: 'brakes',
  14: 'limiter',
  15: 'limiter',
  17: 'limiter',
  31: 'cables',
  32: 'cables',
  33: 'cables',
};

export function isQuarterlyMonth(month: number) {
  return month % 3 === 0;
}

export function isSemesterMonth(month: number) {
  return month % 6 === 0;
}

export function filterQuestionsByChecklistRules(
  allQuestions: ChecklistQuestionRule[],
  currentMonth: number,
  elevatorType: ElevatorKind
): ChecklistQuestionRule[] {
  return allQuestions
    .filter((question) => {
      if (question.frequency === 'T' && !isQuarterlyMonth(currentMonth)) return false;
      if (question.frequency === 'S' && !isSemesterMonth(currentMonth)) return false;
      if (question.is_hydraulic_only && elevatorType !== 'hydraulic') return false;
      return true;
    })
    .sort((a, b) => a.question_number - b.question_number);
}

export function getSpecialTestGroup(questionNumber: number): SpecialTestGroup | null {
  return SPECIAL_TEST_GROUPS[questionNumber] ?? null;
}

export function isSpecialTestQuestion(questionNumber: number): boolean {
  return getSpecialTestGroup(questionNumber) !== null;
}

export function getSpecialTestTitle(group: SpecialTestGroup): string {
  switch (group) {
    case 'brakes':
      return 'Pruebas de Frenos';
    case 'limiter':
      return 'Pruebas de Limitador';
    case 'cables':
      return 'Pruebas de Cables';
  }
}

export function getSpecialTestViewMode(group: SpecialTestGroup) {
  switch (group) {
    case 'brakes':
      return 'tests-brakes' as const;
    case 'limiter':
      return 'tests-limiter' as const;
    case 'cables':
      return 'tests-cables' as const;
  }
}

export function getSpecialTestMetadata(rawObservations?: string | null) {
  if (!rawObservations?.startsWith('__special_test__|')) {
    return null;
  }

  const [, group = '', action = '', ...rest] = rawObservations.split('|');
  const reason = rest.join('|').trim();

  return {
    group: group as SpecialTestGroup,
    action,
    reason,
  };
}

export function buildSpecialTestObservation(
  group: SpecialTestGroup,
  action: 'go' | 'postponed',
  reason?: string
) {
  return `__special_test__|${group}|${action}|${(reason ?? '').trim()}`;
}

export function getSpecialTestStatusLabel(rawObservations?: string | null) {
  const meta = getSpecialTestMetadata(rawObservations);
  if (!meta) return null;

  if (meta.action === 'postponed') {
    return meta.reason ? `Prueba pospuesta: ${meta.reason}` : 'Prueba pospuesta';
  }

  return 'Derivado a vista de prueba';
}
