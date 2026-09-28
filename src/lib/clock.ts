/** Current time for server components (kept out of render bodies for the React purity lint). */
export function nowMs() {
  return new Date().getTime();
}
