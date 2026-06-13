"use client";

import { useEffect, useState } from "react";
import { resolveContractId, resolveRouteParam } from "./routeParams";

/** Client-only contract ID (?id= on GitHub Pages, then path fallback). */
export function useContractId(param: string | string[] | undefined): string {
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    const update = () => setResolved(resolveContractId(param));
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [param]);

  return resolved;
}

/** Client-only route param that re-resolves after navigation settles on static hosting. */
export function useResolvedRouteParam(
  param: string | string[] | undefined,
  pathSegmentIndex: number
): string {
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    const update = () => {
      setResolved(resolveRouteParam(param, pathSegmentIndex));
    };

    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, [param, pathSegmentIndex]);

  return resolved;
}
