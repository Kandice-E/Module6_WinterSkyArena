import * as THREE from 'three';
//import { Capsule } from 'three/examples/jsm/math/Capsule.js';
//import { Octree } from 'three/examples/jsm/math/Octree.js';
//import { camera } from './main.js';

//const sceneCamera = camera;
function updatePlayer(deltaTime, playerOnFloor, playerVelocity, playerCollider, worldOctree, GRAVITY, camera) {
    let damping = Math.exp( - 4 * deltaTime ) - 1;
    if ( !playerOnFloor ) {
        playerVelocity.y -= GRAVITY * deltaTime; // 5x gravity when not on the floor
        // small air resistance
        damping *= 0.6;
    }
    playerVelocity.addScaledVector( playerVelocity, damping);
    const deltaPosition = playerVelocity.clone().multiplyScalar( deltaTime );
    playerCollider.translate( deltaPosition );
    playerCollisions(worldOctree, playerCollider, playerOnFloor, playerVelocity);
    //console.log(camera.position);
    camera.position.copy( playerCollider.end );
}
function playerCollisions(worldOctree, playerCollider, playerOnFloor, playerVelocity) {
    const result = worldOctree.capsuleIntersect( playerCollider );
    //console.log(result);
    playerOnFloor = false;
    if ( result ) {
        playerOnFloor = result.normal.y > 0;
        if ( ! playerOnFloor ) {
            playerVelocity.addScaledVector( result.normal, - result.normal.dot( playerVelocity ) );
        }
        if ( result.depth >= 1e-10 ) {
            playerCollider.translate( result.normal.multiplyScalar( result.depth ) );
        }
    }
}
function updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, playerCollider, playerVelocity, vector1, vector2, vector3 ) {
    spheres.forEach( sphere => {
        sphere.collider.center.addScaledVector( sphere.velocity, deltaTime );
        const result = worldOctree.sphereIntersect( sphere.collider );
        if ( result ) {
            sphere.velocity.addScaledVector( result.normal, - result.normal.dot( sphere.velocity ) * 1.5 );
            sphere.collider.center.add( result.normal.multiplyScalar( result.depth ) );
        } else {
            sphere.velocity.y -= GRAVITY * deltaTime;
        }
        const damping = Math.exp( - 1.5 * deltaTime ) - 1;
        sphere.velocity.addScaledVector( sphere.velocity, damping );
        playerSphereCollision( sphere, playerCollider, playerVelocity, vector1, vector2, vector3 );
    } );
    spheresCollisions();
    for ( const sphere of spheres ) {
        sphere.mesh.position.copy( sphere.collider.center );
    }
}
function playerSphereCollision(sphere, playerCollider, playerVelocity, vector1, vector2, vector3) {
    const center = vector1.addVectors( playerCollider.start, playerCollider.end ).multiplyScalar( 0.5 );
    const sphere_center = sphere.collider.center;
    const r = playerCollider.radius + sphere.collider.radius;
    const r2 = r * r;
    // approximation: player = 3 spheres
    for ( const point of [ playerCollider.start, playerCollider.end, center ] ) {
        const d2 = point.distanceToSquared( sphere_center );
        if ( d2 < r2 ) {
            const normal = vector1.subVectors( point, sphere_center ).normalize();
            const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( playerVelocity ) );
            const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( sphere.velocity ) );
            playerVelocity.add( v2 ).sub( v1 );
            sphere.velocity.add( v1 ).sub( v2 );
            const d = ( r - Math.sqrt( d2 ) ) / 2;
            sphere_center.addScaledVector( normal, - d );
        }
    }
}
function spheresCollisions(spheres, vector1, vector2, vector3) {
    for ( let i = 0, length = spheres.length; i < length; i ++ ) {
        const s1 = spheres[ i ];
        for ( let j = i + 1; j < length; j ++ ) {
            const s2 = spheres[ j ];
            const d2 = s1.collider.center.distanceToSquared( s2.collider.center );
            const r = s1.collider.radius + s2.collider.radius;
            const r2 = r * r;
            if ( d2 < r2 ) {
                const normal = vector1.subVectors( s1.collider.center, s2.collider.center ).normalize();
                const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( s1.velocity ) );
                const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( s2.velocity ) );
                s1.velocity.add( v2 ).sub( v1 );
                s2.velocity.add( v1 ).sub( v2 );
                const d = ( r - Math.sqrt( d2 ) ) / 2;
                s1.collider.center.addScaledVector( normal, d );
                s2.collider.center.addScaledVector( normal, - d );
            }
        }
    }
}
function teleportPlayerIfOob(camera, playerCollider) {
    if ( camera.position.y <= -25 ) {
        playerCollider.start.set( 0, 10, 0 );
        playerCollider.end.set( 0, 20, 0 );
        playerCollider.radius = 10;
        camera.position.copy( playerCollider.end );
        camera.rotation.set( 0, 0, 0 );
    }
}
function throwBall(spheres, sphereIdx, camera, playerCollider, playerVelocity, playerDirection, mouseTime) {
    const sphere = spheres[ sphereIdx ];
    camera.getWorldDirection( playerDirection );
    sphere.collider.center.copy( playerCollider.end ).addScaledVector( playerDirection, playerCollider.radius * 1.5 );
    // throw the ball with more force if we hold the button longer, and if we move forward
    const impulse = 15 + 30 * ( 1 - Math.exp( ( mouseTime - performance.now() ) * 0.001 ) );
    sphere.velocity.copy( playerDirection ).multiplyScalar( impulse );
    sphere.velocity.addScaledVector( playerVelocity, 2 );
    sphereIdx = ( sphereIdx + 1 ) % spheres.length;
}
export { updatePlayer, updateSpheres, teleportPlayerIfOob, throwBall};
