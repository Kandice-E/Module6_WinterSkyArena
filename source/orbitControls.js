import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';

export function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}
export function addFirstPersonControls(camera, domElement) {
    const firstPersonControls = new FirstPersonControls(camera, domElement);
    firstPersonControls.movementSpeed = 5;
    firstPersonControls.lookSpeed = 0.005;
    //firstPersonControls.noFly = true;
    firstPersonControls.lookVertical = true;
    return firstPersonControls;
}