// SPDX-License-Identifier: AGPL-3.0-or-later
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const norm360 = (x: number): number => {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
};
/** Normalise to (-180, 180]. */
export const norm180 = (x: number): number => {
  const r = norm360(x);
  return r > 180 ? r - 360 : r;
};
export const sind = (x: number): number => Math.sin(x * DEG);
export const cosd = (x: number): number => Math.cos(x * DEG);
export const tand = (x: number): number => Math.tan(x * DEG);
export const atan2d = (y: number, x: number): number => Math.atan2(y, x) * RAD;
export const asind = (x: number): number => Math.asin(x) * RAD;
export const acosd = (x: number): number => Math.acos(x) * RAD;
