import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    return scene;
};
export function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 6000);
    camera.position.z = 600;
    camera.position.y = 100;
    camera.position.x = -115;
    camera.rotation.order = 'YXZ';
    return camera;
};
export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    //renderer.shadowMap.type = THREE.VSMShadowMap;
    //renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
};