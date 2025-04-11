import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}