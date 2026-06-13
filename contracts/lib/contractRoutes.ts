/** Static-hosting-safe admin contract URLs (GitHub Pages has no path rewrites). */
export function contractDetailHref(contractId: string): string {
  return `/admin/contracts/_/?id=${encodeURIComponent(contractId)}`;
}

export function contractEditHref(contractId: string): string {
  return `/admin/contracts/_/edit/?id=${encodeURIComponent(contractId)}`;
}

export function contractRenewHref(contractId: string): string {
  return `/admin/contracts/_/renew/?id=${encodeURIComponent(contractId)}`;
}
