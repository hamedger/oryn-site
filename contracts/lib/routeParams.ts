/** Resolve dynamic route param when static hosting serves the placeholder page. */
export function resolveRouteParam(
  param: string | string[] | undefined,
  pathSegmentIndex: number
): string {
  const value = Array.isArray(param) ? param[0] : param;
  if (value && value !== "_") return value;
  if (typeof window === "undefined") return String(value || "");

  const stored = sessionStorage.getItem("oryn-spa-path");
  const pathname = stored || window.location.pathname;
  if (stored) sessionStorage.removeItem("oryn-spa-path");

  const parts = pathname.split("/").filter(Boolean);
  return parts[pathSegmentIndex] ?? "";
}
