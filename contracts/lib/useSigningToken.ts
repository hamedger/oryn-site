"use client";

import { useEffect, useState } from "react";
import { resolveSigningToken } from "./routeParams";

/** Client-only signing token (?token= on GitHub Pages, then path fallback). */
export function useSigningToken(param: string | string[] | undefined): string {
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    const update = () => setResolved(resolveSigningToken(param));
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [param]);

  return resolved;
}
