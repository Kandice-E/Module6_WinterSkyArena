import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { throwBall } from './gamePhysics';

// Module-level variable to hold current playerStats reference
let currentPlayerStats = null;

// Setter function to update playerStats reference when metrics are reset
function setCurrentPlayerStats(stats) {
    currentPlayerStats = stats;
}

function addControls(camera, domElement) {
    const orbitControls = new OrbitControls(camera, domElement);
    return orbitControls;
}
function eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, player, playerStats) {
    // Initialize currentPlayerStats with the initial reference
    currentPlayerStats = playerStats;
    document.addEventListener( 'keydown', ( event ) => {
        if ( event.key === ' ' ) {
            //console.log("Space bar pressed!");
        }
        keyStates[ event.key ] = true;
    } );
    document.addEventListener( 'keyup', ( event ) => {
        if ( event.key === ' ') {
            //console.log("Space bar released!");
        }
        keyStates[ event.key ] = false;
    } );
    document.addEventListener( 'mousedown', (event) => {
    // Prevent Pointer Lock If Clicking On UI Elements
    if (event.target.tagName === 'BUTTON' || event.target.id === 'start-screen') {
        //console.log("Pointer lock prevented on UI element.");
        return;
    }
        document.body.requestPointerLock();
        mouseTime = performance.now();
    } );
    document.addEventListener( 'mouseup', () => {
        if ( document.pointerLockElement !== null ) {
            sphereIdx = throwBall(spheres, sphereIdx, camera, mouseTime, player);
            // Track player ball throw in playerStats (access current module-level reference)
            currentPlayerStats.ballsThrown += 1;
            //console.log(`[PLAYER THROW] balls thrown now: ${currentPlayerStats.ballsThrown}`);
            // Track player action latency (time from mouse down to mouse up = throw charge time)
            const throwLatency = (performance.now() - mouseTime) / 1000; // Convert ms to seconds
            currentPlayerStats.actionLatencies.push(throwLatency);
        }
    } );
    document.body.addEventListener( 'mousemove', ( event ) => {
        if ( document.pointerLockElement === document.body ) {
            camera.rotation.y -= event.movementX / 500;
            camera.rotation.x -= event.movementY / 500;
        }
    } );
}
function controls(keyStates, camera, deltaTime, player) {
   //console.log("Player in Controls: ", player); DEBUG LINE: CAN SAFELY REMOVE ONCE TESTING FINISHED
    // Gives A Bit Of Air Control
    const speedDelta = deltaTime * ( player.onFloor ? 30 : 8 );
    let forward = new THREE.Vector3();
    let side = new THREE.Vector3();
    
    if ( keyStates[ 'w' ] ) {
        forward.copy(getForwardVector(camera, player));
        player.velocity.add( forward.clone().multiplyScalar( speedDelta ) );
    }
    if ( keyStates[ 's' ] ) {
        forward.copy(getForwardVector(camera, player));
        player.velocity.add( forward.clone().multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'a' ] ) {
        side.copy(getSideVector(camera, player));
        player.velocity.add( side.clone().multiplyScalar( - speedDelta ) );
    }
    if ( keyStates[ 'd' ] ) {
        side.copy(getSideVector(camera, player));
        player.velocity.add( side.clone().multiplyScalar( speedDelta ) );
    }
    if ( keyStates[ ' ' ] && player.onFloor ) {
        //console.log("Velocity:", player.velocity); //DEBUG LINE: CAN SAFELY REMOVE ONCE TESTING FINISHED
        player.velocity.y = 15;
        player.jumpCount += 1;
        //console.log("Player Velocity Y:", player.velocity.y); //DEBUG LINE: CAN SAFELY REMOVE ONCE TESTING FINISHED
    }
}
function getForwardVector(camera, player) {
    camera.getWorldDirection( player.getDirection() );
    player.setDirectionY(0);
    player.getDirection().normalize();
    return player.getDirection();
}
function getSideVector(camera, player) {
    camera.getWorldDirection( player.getDirection() );
    player.setDirectionY(0);
    player.getDirection().normalize();
    player.getDirection().cross( camera.up );
    return player.getDirection();
}
export { addControls, controls, eventListeners, setCurrentPlayerStats };