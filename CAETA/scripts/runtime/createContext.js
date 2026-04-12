import * as THREE from 'https://esm.sh/three@0.161.0';
import { OrbitControls } from 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { DATA } from '../data.js';

export function createRuntimeContext() {
  return { THREE, OrbitControls, DATA, window, document, console, history, localStorage, URL, Math, Path2D, requestAnimationFrame, setTimeout, clearTimeout, performance };
}
