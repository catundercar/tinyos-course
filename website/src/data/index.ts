import { phase0ZhCN, phase0En } from "./phase0";
import { phase1ZhCN, phase1En } from "./phase1";
import { phase2ZhCN, phase2En } from "./phase2";
import { phase3ZhCN, phase3En } from "./phase3";
import { phase4ZhCN, phase4En } from "./phase4";
import { phase5ZhCN, phase5En } from "./phase5";
import { phase6ZhCN, phase6En } from "./phase6";
import type { PhaseContent, Lesson } from "./types";
import type { Locale } from "../i18n";

// NOTE on zh-TW: this course ships only zh-CN + en lesson content.
// To keep the LanguageSwitcher a three-way toggle (template convention),
// zh-TW falls back to the zh-CN dataset. UI chrome strings in
// src/i18n/zh-TW.ts also alias to zh-CN. Adding real Traditional
// Chinese content later is a matter of translating the phaseN.ts files.
const PHASE_CONTENT: Record<string, Record<number, PhaseContent>> = {
  "zh-CN": {
    0: phase0ZhCN, 1: phase1ZhCN, 2: phase2ZhCN, 3: phase3ZhCN,
    4: phase4ZhCN, 5: phase5ZhCN, 6: phase6ZhCN,
  },
  "zh-TW": {
    0: phase0ZhCN, 1: phase1ZhCN, 2: phase2ZhCN, 3: phase3ZhCN,
    4: phase4ZhCN, 5: phase5ZhCN, 6: phase6ZhCN,
  },
  en: {
    0: phase0En, 1: phase1En, 2: phase2En, 3: phase3En,
    4: phase4En, 5: phase5En, 6: phase6En,
  },
};

export function getPhaseContent(phaseId: number, locale: Locale = "zh-CN"): PhaseContent | undefined {
  return PHASE_CONTENT[locale]?.[phaseId] ?? PHASE_CONTENT["zh-CN"]?.[phaseId];
}

export function getLesson(phaseId: number, lessonId: number, locale: Locale = "zh-CN"): Lesson | undefined {
  const phase = getPhaseContent(phaseId, locale);
  return phase?.lessons.find((l) => l.lessonId === lessonId);
}

export function hasLessons(phaseId: number): boolean {
  return phaseId in PHASE_CONTENT["zh-CN"];
}

export type { PhaseContent, Lesson } from "./types";
