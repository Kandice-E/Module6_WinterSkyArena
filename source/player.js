import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

export class Player {
    constructor(){
        this.velocity = new THREE.Vector3(0, 0, 0),
        this.direction = new THREE.Vector3(1, 0, 0),
        this.onFloor = false,
        this.timeSurvived = 0,
        this.jumpFrequency = 0,
        this.jumpCount = 0,
        this.turnSpeed = 0,
        this.score = 0,
        this.numberOfLives = 2,
        this.safeFrames = 0,
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