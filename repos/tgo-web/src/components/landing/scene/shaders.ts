/**
 * GLSL for the procedural space environment.
 *
 * The grid and the particle field share the same curvature function and the
 * same notion of "travel", so particles that start on grid intersections stay
 * locked to the lines until they lift off.
 */

const curvature = /* glsl */ `
  uniform float uCurvature;
  uniform float uFloorY;
  uniform vec3 uCamPos;
  // Bend the floor away from the viewer to suggest a planetary horizon.
  vec3 curveWorld(vec3 p) {
    vec2 d = p.xz - uCamPos.xz;
    p.y -= uCurvature * dot(d, d);
    return p;
  }
  // Past the horizon the curved floor would fold back into view – fade it out.
  float horizonFade(float dist) {
    float horizon = sqrt(max(uCamPos.y - uFloorY, 0.2) / uCurvature);
    return 1.0 - smoothstep(horizon * 0.8, horizon * 1.05, dist);
  }
`;

const hash = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
`;

export const gridVertexShader = /* glsl */ `
  ${curvature}
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(world.xyz), 1.0);
  }
`;

export const gridFragmentShader = /* glsl */ `
  ${curvature}
  uniform float uTravel;
  uniform float uCell;
  uniform float uOpacity;
  uniform float uDissolve;
  uniform float uReveal;
  uniform vec2 uRevealOrigin;
  uniform float uTime;
  uniform vec3 uLineColor;
  uniform vec3 uAccent;
  varying vec3 vWorld;
  ${hash}

  void main() {
    vec2 coord = vec2(vWorld.x, vWorld.z - uTravel) / uCell;
    vec2 fw = max(fwidth(coord), vec2(1e-4));
    vec2 g = abs(fract(coord - 0.5) - 0.5) / fw;
    float line = 1.0 - min(min(g.x, g.y), 1.0);

    // Drop lines once cells shrink below a few pixels – avoids moire at the horizon.
    float lod = 1.0 - smoothstep(0.12, 0.42, max(fw.x, fw.y));

    float dist = length(vWorld.xz - uCamPos.xz);
    float fade = exp(-dist * 0.03) * smoothstep(1.0, 5.0, dist) * horizonFade(dist);

    // Grow outwards from the point where the halo sank into the floor.
    float reach = length(vWorld.xz - uRevealOrigin);
    float reveal = 1.0 - smoothstep(uReveal * 130.0 - 10.0, uReveal * 130.0, reach);

    vec2 cell = floor(coord);
    float h = hash21(cell);
    // Cells erode in random order as the grid dissolves into particles.
    float keep = smoothstep(uDissolve * 1.12 - 0.1, uDissolve * 1.12, h);

    // A handful of cells carry a slow lime pulse.
    float accentCell = step(0.988, hash21(cell + 17.3));
    float pulse = accentCell * smoothstep(0.35, 1.0, sin(uTime * 0.9 + h * 40.0));
    vec3 color = mix(uLineColor, uAccent, pulse);

    float alpha = line * lod * fade * reveal * keep * uOpacity * mix(0.42, 0.9, pulse);
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const particleVertexShader = /* glsl */ `
  ${curvature}
  attribute vec3 aLift;
  attribute vec4 aSeed;
  attribute float aAccent;
  uniform float uTravel;
  uniform float uDepth;
  uniform float uZNear;
  uniform float uMorph;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;
  uniform float uQuiet;
  varying float vAlpha;
  varying float vAccent;

  float wrapZ(float z) {
    return uZNear - mod(uZNear - z, uDepth);
  }

  void main() {
    // position.xz is a grid intersection; it travels with the grid lines.
    float z = wrapZ(position.z + uTravel);
    vec3 onGrid = curveWorld(vec3(position.x, uFloorY, z));

    // Staggered lift-off: every particle leaves the grid at its own moment.
    float m = clamp((uMorph - aSeed.x * 0.45) / 0.55, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);

    float calm = 1.0 - uQuiet * 0.75;
    vec3 drift = vec3(
      sin(uTime * 0.13 + aSeed.y * 6.2831),
      cos(uTime * 0.11 + aSeed.z * 6.2831),
      0.0
    ) * 0.3 * calm;
    vec3 inSpace = vec3(position.x * 0.9 + aLift.x, uFloorY + aLift.y, z + aLift.z) + drift * m;
    vec3 p = mix(onGrid, inSpace, m);

    float gridDist = length(onGrid.xz - uCamPos.xz);
    float onFloor = mix(horizonFade(gridDist), 1.0, m);

    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float depth = -mv.z;
    float nearFade = 1.0 - smoothstep(uZNear - 5.0, uZNear, z);
    float farFade = smoothstep(uZNear - uDepth, uZNear - uDepth + 22.0, z);
    float closeFade = smoothstep(0.6, 2.5, depth);
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.4 + aSeed.y) + aSeed.z * 30.0) * calm;

    // Perspective size, clamped: distant points stay a crisp pixel (dimmed
    // instead of shrinking further) and near points never balloon.
    float size = uSize * aSeed.w * (1.0 + aAccent * 0.6) / max(depth, 0.1);
    float subPixel = clamp(size, 0.3, 1.0);

    vAccent = aAccent;
    vAlpha = uOpacity * onFloor * nearFade * farFade * closeFade * twinkle * subPixel * mix(0.5, 1.0, m);
    gl_PointSize = clamp(size, 1.0, 7.0) * uPixelRatio;
  }
`;

export const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying float vAlpha;
  varying float vAccent;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    core *= core;
    float alpha = core * vAlpha;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(mix(uColor, uAccent, vAccent), alpha);
  }
`;

/* ───────────── Hero sculpture: filament + debris ───────────── */

export const filamentVertexShader = /* glsl */ `
  attribute float aDissolve;
  varying float vU;
  varying float vFacing;
  varying float vDissolve;
  void main() {
    vU = uv.x;
    vDissolve = aDissolve;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

export const filamentFragmentShader = /* glsl */ `
  uniform float uHead;
  uniform float uLength;
  uniform float uIntensity;
  uniform float uDissolve;
  uniform float uGlow;
  uniform vec3 uColor;
  varying float vU;
  varying float vFacing;
  varying float vDissolve;

  // Brightness of a stream whose head sits at 'head' along the closed path.
  // fract() makes the wrap seamless: there is no start or end to jump from.
  float stream(float head, float len) {
    float d = fract(head - vU);
    return exp(-d / len * 4.0);
  }

  void main() {
    float s = stream(uHead, uLength) + 0.35 * stream(uHead + 0.47, uLength * 0.55);
    // Disappears together with the patch of surface it rides on.
    float keep = smoothstep(uDissolve - 0.025, uDissolve, vDissolve);
    // Core: solid across the tube. Glow: soft falloff towards the silhouette.
    float profile = mix(0.6 + 0.4 * vFacing, pow(vFacing, 2.0) * 0.3, uGlow);
    float alpha = s * keep * uIntensity * profile;
    if (alpha < 0.002) discard;
    // The hottest part of the core shifts slightly towards white.
    vec3 color = mix(uColor, vec3(0.96, 1.0, 0.86), (1.0 - uGlow) * smoothstep(0.55, 1.0, s) * 0.6);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const debrisVertexShader = /* glsl */ `
  attribute vec3 aDir;
  attribute float aThreshold;
  attribute vec4 aSeed; // flight distance, recession, lime flag, size
  uniform float uDissolve;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vLime;
  varying float vSpark;

  void main() {
    // Released at the exact moment the surface under it is discarded.
    float r = clamp((uDissolve - aThreshold) / 0.35, 0.0, 1.0);
    float e = 1.0 - (1.0 - r) * (1.0 - r);
    vec3 p = position + aDir * e * aSeed.x;
    p += vec3(
      sin(uTime * 0.7 + aSeed.y * 30.0),
      cos(uTime * 0.6 + aSeed.w * 20.0),
      sin(uTime * 0.5 + aSeed.x * 10.0)
    ) * 0.035 * e;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Drift away from the viewer as the cloud thins out, clearing the centre.
    mv.z -= e * e * (0.5 + aSeed.y * 2.5);
    gl_Position = projectionMatrix * mv;

    float born = step(0.0001, r);
    vSpark = 1.0 - smoothstep(0.0, 0.18, r);
    vLime = aSeed.z;
    vAlpha = born * smoothstep(0.0, 0.03, r) * (1.0 - smoothstep(0.45, 1.0, r)) * uOpacity;
    gl_PointSize = born * clamp(uSize * aSeed.w / max(-mv.z, 0.1), 1.0, 4.0) * uPixelRatio;
  }
`;

export const debrisFragmentShader = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uLime;
  varying float vAlpha;
  varying float vLime;
  varying float vSpark;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.0, 0.5, d);
    a *= a * vAlpha * (1.0 + vSpark * 1.5);
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(uWarm, uLime, vLime), a);
  }
`;
