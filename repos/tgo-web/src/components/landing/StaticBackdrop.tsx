/**
 * Shown when WebGL 2 is unavailable: a still, line-drawn halo in place of the
 * 3D scene so the page keeps its composition without the renderer.
 */
export function StaticBackdrop() {
  return (
    <div className="lp-webgl lp-webgl--static" aria-hidden="true">
      <svg viewBox="-200 -200 400 400" className="lp-static-halo">
        <ellipse cx="0" cy="0" rx="150" ry="58" transform="rotate(-14)" />
        <ellipse cx="0" cy="6" rx="128" ry="46" transform="rotate(-14)" />
      </svg>
    </div>
  );
}

let cachedSupport: boolean | null = null;

export function supportsWebGL2(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    cachedSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cachedSupport = false;
  }
  return cachedSupport;
}
