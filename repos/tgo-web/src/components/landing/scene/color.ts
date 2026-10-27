import { Vector3 } from 'three';

/**
 * Hex colour → raw sRGB components for custom shaders. The shaders write
 * straight to the sRGB framebuffer, so no linear conversion is applied.
 */
export const hexToVec3 = (hex: string): Vector3 => {
  const n = parseInt(hex.replace('#', ''), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
