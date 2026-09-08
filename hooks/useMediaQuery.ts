"use client";

import { useEffect, useState } from "react";

function getMatches(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const [prevQuery, setPrevQuery] = useState(query);
  const [matches, setMatches] = useState(() => getMatches(query));

  if (query !== prevQuery) {
    setPrevQuery(query);
    setMatches(getMatches(query));
  }

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
