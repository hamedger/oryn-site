function segmentAt(path: string, pathSegmentIndex: number): string {
  const segment = path.split("/").filter(Boolean)[pathSegmentIndex] ?? "";
  return segment === "_" ? "" : segment;
}

function contractIdFromQuery(): string {
  if (typeof window === "undefined") return "";
  const id = new URLSearchParams(window.location.search).get("id")?.trim();
  return id && id !== "_" ? id : "";
}

/** Resolve dynamic route param when static hosting serves the placeholder page. */
export function resolveRouteParam(
  param: string | string[] | undefined,
  pathSegmentIndex: number
): string {
  const value = Array.isArray(param) ? param[0] : param;
  if (value && value !== "_") return value;
  if (typeof window === "undefined") return "";

  const fromPath = segmentAt(window.location.pathname, pathSegmentIndex);
  if (fromPath) return fromPath;

  const stored = sessionStorage.getItem("oryn-spa-path");
  if (stored) {
    sessionStorage.removeItem("oryn-spa-path");
    const fromStored = segmentAt(stored, pathSegmentIndex);
    if (fromStored) return fromStored;
  }

  return "";
}

/** Contract ID from ?id= query (GitHub Pages) or path fallback. */
export function resolveContractId(
  param: string | string[] | undefined,
  pathSegmentIndex = 2
): string {
  const fromQuery = contractIdFromQuery();
  if (fromQuery) return fromQuery;
  return resolveRouteParam(param, pathSegmentIndex);
}
