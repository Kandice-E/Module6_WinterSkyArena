import * as THREE from 'three';
import { boundingBox } from './pointGeneration';

const rotationSpeed = 0.0001;

export function animatePoints(points) {
    const positions = points.geometry.getAttribute("position").array;
    for (let i = 0; i < positions.length; i+=3){
        positions[i] += (Math.sin(positions[i+1]) + Math.sin(positions[i+2]) * 3) * 0.005;
        positions[i+2] += (Math.sin(positions[i+1]) + Math.sin(positions[i]) * 3) * 0.005;
        const x = positions[i];
        const z = positions[i+2];
        const newX = Math.max(boundingBox.min.x, Math.min(boundingBox.max.x, x));
        const newZ = Math.max(boundingBox.min.z, Math.min(boundingBox.max.z, z));
        positions[i] = newX;
        positions[i+2] = newZ;
        points.geometry.getAttribute("position").needsUpdate = true;
    };
    //points.rotation.y += rotationSpeed;
};
export { rotationSpeed };