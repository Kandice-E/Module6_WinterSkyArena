import * as THREE from 'three';

//-----MATERIALS-----//
const material1 = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    metalness: 0.5,
    roughness: 0.5,
    transparent: true,
    opacity: 0.8
});
//-----GEOMETRIES-----//
//const geometry1 = new THREE.BoxGeometry(5, 5, 5);

const geometry2 = new THREE.SphereGeometry(5, 32, 32);
export function addTarget() {
    const target = new THREE.Mesh(geometry1, material1);
    target.position.set(0, 0, 0);
    //target.scale.set(5, 5, 5);
    target.castShadow = true;
    target.receiveShadow = true;
    return target;
}