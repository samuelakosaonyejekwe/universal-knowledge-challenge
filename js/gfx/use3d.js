// Decides whether the 3D scenes should run on this device, and loads them only when they will be used.
import { profile } from '../core/store.js';

let supported = null;
function webgl() {
  if (supported != null) return supported;
  try { const c = document.createElement('canvas'); supported = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { supported = false; }
  return supported;
}
// "Automatic" shows 3D unless the player has asked their device for less movement.
export function use3d() {
  const mode = profile?.settings.gfx || 'auto';
  if (mode === 'off' || !webgl()) return false;
  if (mode === 'on') return true;
  return profile?.settings.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export const load3d = () => import('./scenes.js');
// Frees a scene once its element has left the page.
export function autoDispose(el, dispose) {
  const id = setInterval(() => { if (!el.isConnected) { clearInterval(id); try { dispose(); } catch { /* already freed */ } } }, 1500);
}
