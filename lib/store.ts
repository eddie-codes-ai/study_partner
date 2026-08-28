import { create } from 'zustand';

import * as db from './db';
import type { SubjectProgress } from './db';

type AppState = {
  ready: boolean;
  grade: string | null;
  streak: number;
  stars: number;
  dueCount: number;
  subjects: SubjectProgress[];
  hydrate: () => void;
  setGrade: (grade: string) => void;
  refresh: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  grade: null,
  streak: 0,
  stars: 0,
  dueCount: 0,
  subjects: [],

  hydrate: () => {
    db.initDb();
    const grade = db.getGrade();
    const gradeNum = grade ? Number(grade) : null;
    set({
      ready: true,
      grade,
      streak: db.getStreak(),
      stars: db.getStars(),
      dueCount: gradeNum ? db.getDueCards(gradeNum, 999).length : 0,
      subjects: gradeNum ? db.getSubjectProgress(gradeNum) : [],
    });
  },

  setGrade: (grade: string) => {
    db.setGrade(grade);
    const gradeNum = Number(grade);
    set({
      grade,
      dueCount: db.getDueCards(gradeNum, 999).length,
      subjects: db.getSubjectProgress(gradeNum),
    });
  },

  // Call after a study session ends so Home/Progress reflect the new state.
  refresh: () => {
    const grade = get().grade;
    const gradeNum = grade ? Number(grade) : null;
    set({
      streak: db.getStreak(),
      stars: db.getStars(),
      dueCount: gradeNum ? db.getDueCards(gradeNum, 999).length : 0,
      subjects: gradeNum ? db.getSubjectProgress(gradeNum) : [],
    });
  },
}));
