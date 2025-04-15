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
function getJumpVector(camera, playerDirection) {
    camera.getWorldDirection( playerDirection );
    //playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}
function controls(keyStates, playerVelocity, camera, playerDirection, deltaTime, playerOnFloor) {
    // gives a bit of air control
    const speedDelta = deltaTime * ( playerOnFloor ? 500 : 300 );
    //camera.updateMatrixWorld();
    //console.log(camera.position);
    //console.log(camera.matrixWorld);
    let forward = new THREE.Vector3();
    let side = new THREE.Vector3();
    let up = new THREE.Vector3();
    //if (camera.matrixWorld) {
        //forward.setFromMatrixColumn(camera.matrixWorld, 0);
        //forward.crossVectors(camera.up, forward).normalize();
  
        //side.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    //}
    if ( keyStates[ 'w' ] ) {
        forward.copy(getForwardVector(camera, playerDirection));
        playerVelocity.add( forward.clone().multiplyScalar( speedDelta * 2 ) );
    }
    if ( keyStates[ 's' ] ) {
        forward.copy(getForwardVector(camera, playerDirection));
        playerVelocity.add( forward.clone().multiplyScalar( - speedDelta * 2 ) );
    }
    if ( keyStates[ 'a' ] ) {
        side.copy(getSideVector(camera, playerDirection));
        playerVelocity.add( side.clone().multiplyScalar( - speedDelta * 2 ) );
    }
    if ( keyStates[ 'd' ] ) {
        side.copy(getSideVector(camera, playerDirection));
        playerVelocity.add( side.clone().multiplyScalar( speedDelta * 2 ) );
    }
    if ( playerOnFloor && keyStates[ 'Space' ] ) {
        //console.log(playerOnFloor);
        //playerOnFloor = true;
        playerVelocity.y = 15;
        console.log("Player Velocity Y:", playerVelocity.y);
        //if ( keyStates[ 'Space' ] ) {
            //console.log(playerOnFloor);
            //playerVelocity.y = 0;
            //up.copy(getJumpVector(camera, playerDirection));
            //playerVelocity.y = 15;
            //console.log("Player Velocity Y:", playerVelocity.y);
        //}
    }
}
export { addControls, controls, eventListeners };
