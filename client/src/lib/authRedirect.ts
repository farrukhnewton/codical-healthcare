export function getAuthCallbackUrl(next = "/dashboard") {
  const params = new URLSearchParams({ next });
  return `${window.location.origin}/auth/callback?${params.toString()}`;
}

export function getPasswordResetUrl() {
  return `${window.location.origin}/reset-password`;
}
