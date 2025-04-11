import * as THREE from 'three';

//-----MATERIALS-----//
const material1 = new THREE.MeshStandardMaterial({color: 0xff0000, side: THREE.DoubleSide});
//-----REGULAR STAIRCASE GEOMETRY-----//
let newStaircase = new THREE.Group();
const numSteps = 25;
const stepWidth = 40;
const stepHeight = 5;
const stepDepth = 5;
function addStep(x, y, z) {
    const geometry = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
    const newStep = new THREE.Mesh(geometry, material1);
    newStep.castShadow = true;
    newStep.position.set(x, y, z);
    return newStep;
};
export function addStaircase() {
    for (let i = 0; i < numSteps; i++){
        const step = addStep(0, stepHeight * i, stepDepth * i);
        step.receiveShadow = true;
        newStaircase.add(step);
    }
    return newStaircase;
};
export function addPlatform(posX, posY, posZ, platformWidth, platformHeight, platformDepth) {
    const geometry = new THREE.BoxGeometry(platformWidth, platformHeight, platformDepth);
    const newPlatform = new THREE.Mesh(geometry, material1);
    newPlatform.castShadow = true;
    newPlatform.receiveShadow = true;
    newPlatform.position.set(posX, posY, posZ);
    return newPlatform;
}
export function addPillar(posX, posY, posZ, stepHeight, pillarRadius) {
    const geometry = new THREE.CylinderGeometry(pillarRadius, pillarRadius * 3, stepHeight, 32);
    const newPillar = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: 0x00ff00})); // Green color for floating steps
    newPillar.material.color.setHex(Math.random() * 0xffffff); // Random color for each step
    newPillar.castShadow = true;
    newPillar.receiveShadow = true;
    newPillar.position.set(posX, posY, posZ);
    return newPillar;
}