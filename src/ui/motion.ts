export const BLAST_STAGGER_MS = 95;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function chainDuration(maxWave: number): number {
  if (prefersReducedMotion()) return 0;
  return maxWave * BLAST_STAGGER_MS + 420;
}
