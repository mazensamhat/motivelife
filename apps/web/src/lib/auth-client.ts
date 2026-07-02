/** Clear session cookie and hard-navigate so cached dashboard shell cannot linger. */
export async function clientLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  window.location.href = "/login";
}
