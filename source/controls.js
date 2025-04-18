import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { throwBall } from './gamePhysics';

function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}
function eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection) {
    document.addEventListener( 'keydown', ( event ) => {
        //console.log("Key down: ", event.key);
        //console.log("Velocity:", playerVelocity);
        if ( event.key === ' ') {
            //event.preventDefault();
            console.log("Space bar pressed!");
        }
        keyStates[ event.key ] = true;
    } );
    document.addEventListener( 'keyup', ( event ) => {
        keyStates[ event.key ] = false;
    } );
    document.addEventListener( 'mousedown', () => {
        document.body.requestPointerLock();
        mouseTime = performance.now();
    } );
    document.addEventListener( 'mouseup', () => {
        if ( document.pointerLockElement !== null ) throwBall(spheres, sphereIdx, camera, playerCollider, playerVelocity, playerDirection, mouseTime);
    } );
    document.body.addEventListener( 'mousemove', ( event ) => {
        if ( document.pointerLockElement === document.body ) {
            camera.rotation.y -= event.movementX / 500;
            camera.rotation.x -= event.movementY / 500;
        }
    } );
}
function getForwardVector(camera, playerDirection) {
    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}
function getSideVector(camera, playerDirection) {
    camera.getWorldDirection( playerDirection );
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross( camera.up );
    return playerDirection;
}
function controls(keyStates, playerVelocity, camera, playerDirection, deltaTime, playerOnFloor) {
    // gives a bit of air control
    const speedDelta = deltaTime * ( playerOnFloor ? 75 : 8 );
   
    let forward = new THREE.Vector3();
    let side = new THREE.Vector3();
    let up = new THREE.Vector3();
    
    if ( keyStates[ 'w' ] ) {
        forward.copy(getForwardVector(camera, playerDirection));
        playerVelocity.add( forward.clone().multiplyScalar( speedDelta * 3 ) );
    }
    if ( keyStates[ 's' ] ) {
        forward.copy(getForwardVector(camera, playerDirection));
        playerVelocity.add( forward.clone().multiplyScalar( - speedDelta * 3 ) );
    }
    if ( keyStates[ 'a' ] ) {
        side.copy(getSideVector(camera, playerDirection));
        playerVelocity.add( side.clone().multiplyScalar( - speedDelta * 3 ) );
    }
    if ( keyStates[ 'd' ] ) {
        side.copy(getSideVector(camera, playerDirection));
        playerVelocity.add( side.clone().multiplyScalar( speedDelta * 3 ) );
    }
    if ( keyStates[ ' ' ] ) {
        console.log("Velocity:", playerVelocity);
        playerVelocity.y = 15;
        console.log("Player Velocity Y:", playerVelocity.y);
        //if ( !playerOnFloor) {
            //playerVelocity.y = 15;
        //}
    }
}
export { addControls, controls, eventListeners };
