import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { throwBall } from './gamePhysics';

function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}
function eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection) {
    document.addEventListener( 'keydown', ( event ) => {
        console.log("Key down: ", event.key);
        console.log("Velocity:", playerVelocity);
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
    const speedDelta = deltaTime * ( playerOnFloor ? 25 : 8 );
    camera.updateMatrixWorld();
    //console.log(camera.position);
    const forward = new THREE.Vector3();
    const side = new THREE.Vector3();
    if (camera.matrixWorld) {
        forward.setFromMatrixColumn(camera.matrixWorld, 0);
        forward.crossVectors(camera.up, forward).normalize();
  
        side.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      }
    if ( keyStates[ 'KeyW' ] ) {
        playerVelocity.add( forward.clone().multiplyScalar( speedDelta ) );
    }
    if ( keyStates[ 'KeyS' ] ) {
        playerVelocity.add( forward.clone().multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'KeyA' ] ) {
        playerVelocity.add( side.clone().multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'KeyD' ] ) {
        playerVelocity.add( side.clone().multiplyScalar( speedDelta ) );
    }
    if ( playerOnFloor ) {
        if ( keyStates[ 'Space' ] ) {
            playerVelocity.y = 15;
        }
    }
}
export { addControls, controls, eventListeners };
