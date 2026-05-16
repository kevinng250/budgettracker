import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "active_profile_id";

interface ActiveProfileValue {
  /** null = combined / household view */
  activeProfileId: number | null;
  setActiveProfileId: (id: number | null) => void;
}

const ActiveProfileContext = createContext<ActiveProfileValue | null>(null);

function readInitial(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    if (raw === "null" || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfileId, setActiveProfileIdState] = useState<number | null>(readInitial);

  useEffect(() => {
    try {
      if (activeProfileId == null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, String(activeProfileId));
      }
    } catch {
      // Non-fatal — fall back to in-memory only.
    }
  }, [activeProfileId]);

  return (
    <ActiveProfileContext.Provider
      value={{ activeProfileId, setActiveProfileId: setActiveProfileIdState }}
    >
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile(): ActiveProfileValue {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error("useActiveProfile must be used within ActiveProfileProvider");
  }
  return ctx;
}
