import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

export class Player {
    constructor(){
        this.velocity = new THREE.Vector3(1,1,1),
        this.direction = new THREE.Vector3(1,1,1),
        this.onFloor = false,
        this.timeSurvived = 1,
        this.jumpFrequency = 1,
        this.jumpCount = 1,
        this.turnSpeed = 1,
        this.collider = new Capsule(
        new THREE.Vector3( 0.1, 0.35, 0.1 ),
        new THREE.Vector3( 0.1, 1, 0.1 ),
        0.35 )
    }
    setDirection(x, y, z){
        this.direction = new THREE.Vector3(x, y, z);
    }
    setDirectionX(x) {
        this.direction.x = x;
    }
    setDirectionY(y) {
        this.direction.y = y;
    }
    setDirectionZ(z) {
        this.direction.z = z;
    }
    getDirection() {
        return this.direction
    }
}