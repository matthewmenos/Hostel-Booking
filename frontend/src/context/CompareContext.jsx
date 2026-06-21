import { createContext, useContext, useState } from "react";

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [compared, setCompared] = useState([]); // array of hostel objects (max 3)

  const toggle = (hostel) => {
    setCompared((prev) => {
      if (prev.find((h) => h.slug === hostel.slug)) {
        return prev.filter((h) => h.slug !== hostel.slug);
      }
      if (prev.length >= 3) return prev; // max 3
      return [...prev, hostel];
    });
  };

  const isCompared = (slug) => compared.some((h) => h.slug === slug);
  const clear = () => setCompared([]);

  return (
    <CompareContext.Provider value={{ compared, toggle, isCompared, clear }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
