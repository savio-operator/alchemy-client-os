import { create } from "zustand";

interface FinanceState {
  selectedMonth: string; // YYYY-MM
  setSelectedMonth: (month: string) => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const useFinance = create<FinanceState>((set) => ({
  selectedMonth: getCurrentMonth(),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
}));
