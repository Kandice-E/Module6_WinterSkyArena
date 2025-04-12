import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { throwBall } from './gamePhysics';

function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}
function eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection) {
    document.addEventListener( 'keydown', ( event ) => {
        keyStates[ event.code ] = true;
    } );
    document.addEventListener( 'keyup', ( event ) => {
        keyStates[ event.code ] = false;
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
    const speedDelta = deltaTime * ( playerOnFloor ? 25 : 8 );

    if ( keyStates[ 'KeyW' ] ) {
        playerVelocity.add( getForwardVector(camera, playerDirection).multiplyScalar( speedDelta ) );
    }
    if ( keyStates[ 'KeyS' ] ) {
        playerVelocity.add( getForwardVector(camera, playerDirection).multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'KeyA' ] ) {
        playerVelocity.add( getSideVector(camera, playerDirection).multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'KeyD' ] ) {
        playerVelocity.add( getSideVector(camera, playerDirection).multiplyScalar( speedDelta ) );
    }
    if ( playerOnFloor ) {
        if ( keyStates[ 'Space' ] ) {
            playerVelocity.y = 15;
        }
    }
}
export { addControls, controls, eventListeners };
