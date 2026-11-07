import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  ageConfirmed: boolean;
  confirmAge: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ageConfirmed: false,
      confirmAge: () => set({ ageConfirmed: true }),
    }),
    { name: "sf-session" }
  )
);
