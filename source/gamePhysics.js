import * as THREE from 'three';
import { endGame, updateScoreDisplay } from './main.js';

function updatePlayer(deltaTime, playerOnFloor, playerVelocity, playerCollider, worldOctree, GRAVITY, camera) {
    let damping = Math.exp( - 4 * deltaTime ) - 1;
    if ( !playerOnFloor.onFloor ) {
        playerVelocity.y -= GRAVITY * deltaTime;
        // Small Air Resistance
        damping *= 0.1;
    }
    playerVelocity.addScaledVector( playerVelocity, damping);
    const deltaPosition = playerVelocity.clone().multiplyScalar( deltaTime );
    playerCollider.translate( deltaPosition );
    playerCollisions(worldOctree, playerCollider, playerOnFloor, playerVelocity);
    camera.position.copy( playerCollider.end );
}
function playerCollisions(worldOctree, playerCollider, playerOnFloor, playerVelocity) {
    const result = worldOctree.capsuleIntersect( playerCollider );
    playerOnFloor.onFloor = false;
    if ( result ) {
        playerOnFloor.onFloor = result.normal.y > 0;
        if ( ! playerOnFloor.onFloor ) {
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
    spheresCollisions(spheres, vector1, vector2, vector3);
    for ( const sphere of spheres ) {
        sphere.mesh.position.copy( sphere.collider.center );
    }
}
function playerSphereCollision(sphere, playerCollider, playerVelocity, vector1, vector2, vector3) {
    const center = vector1.addVectors( playerCollider.start, playerCollider.end ).multiplyScalar( 0.5 );
    const sphere_center = sphere.collider.center;
    const r = playerCollider.radius + sphere.collider.radius;
    const r2 = r * r;
    // Approximation: player = 3 spheres
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
function updateEnemiesAndTargets(deltaTime, enemies, targets, enemyAndTargetBounds) {
    enemies.forEach(enemy => {
        // Update Enemy Position Based On Velocity And Direction
        enemy.collider.center.y += enemy.velocity.y * enemy.direction * deltaTime;
        // Reverse Direction If The Enemy Reaches The Upper Or Lower Bounds
        if (enemy.collider.center.y > enemyAndTargetBounds.maxY) {
            enemy.direction = -1; // Move down
        } else if (enemy.collider.center.y < enemyAndTargetBounds.minY) {
            enemy.direction = 1; // Move up
        }
        // Update Enemy Mesh Position
        enemy.mesh.position.copy(enemy.collider.center);
    });
    targets.forEach(target => {
        // Update Target Position Based On Velocity And Direction
        target.collider.center.y += target.velocity.y * target.direction * deltaTime;
        // Reverse Direction If The Target Reaches The Upper Or Lower Bounds
        if (target.collider.center.y > enemyAndTargetBounds.maxY) {
            target.direction = -1; // Move down
        } else if (target.collider.center.y < enemyAndTargetBounds.minY) {
            target.direction = 1; // Move up
        }
        // Update Target Mesh Position
        target.mesh.position.copy(target.collider.center);
    });
}

// General Collision Detection Function For Player-Enemy Collisions and NPC Collisions
function checkForEnemyCollisions(npcCollider, playerCollider, enemies, camera) {
    for (const enemy of enemies) {
        const distance1 = npcCollider.start.distanceTo(enemy.collider.center);
        const distance2 = playerCollider.start.distanceTo(enemy.collider.center);
        const combinedRadius1 = npcCollider.radius + enemy.collider.radius;
        const combinedRadius2 = playerCollider.radius + enemy.collider.radius;
        if (distance1 < combinedRadius1) {
            console.log("NPC collided with an enemy.");
            npcCollider.start.set( 0, 0.35, 0 );
            npcCollider.end.set( 0, 1, 0 );
            npcCollider.radius = 0.35;
            endGame(); // Call the game-over function
            break;
        }
        if (distance2 < combinedRadius2) {
            console.log("Player collided with an enemy.");
            playerCollider.start.set( 0, 0.35, 0 );
            playerCollider.end.set( 0, 1, 0 );
            playerCollider.radius = 0.35;
            camera.position.copy( playerCollider.end );
            camera.rotation.set( 0, 0, 0 );
            endGame(); // Call the game-over function
            break;
        }
    }
}
function checkBallTargetCollisions(spheres, targets, score, npc, worldOctree) {
    spheres.forEach (sphere => {
        for (const target of targets) {
            const distance = sphere.collider.center.distanceTo(target.collider.center);
            const combinedRadius = sphere.collider.radius + target.collider.radius;
            if (distance < combinedRadius) {
                if (target === targets[npc.targetIndex]) {
                    console.log("NPC hit a target!");
                    score.npcCounter += 1;
                }
                else {
                    console.log("Player hit a target!");
                    score.counter += 1;
                }
                updateScoreDisplay(score); // Update the score display
                // Move Target To A New Random Position
                checkTargetWallCollisions(target, worldOctree); // Ensure the new target position is valid and not inside a wall
                break; // Exit loop after first collision to prevent multiple hits on the same target
            }
        }
    });
}
function checkTargetWallCollisions(target, worldOctree) {
    // Move Target To A New Random Position
    const randomX = Math.random() * 30 - 15; // Adjust based on your octree bounds
    const randomY = Math.random() * 10 + 1;  // Adjust based on your octree bounds
    const randomZ = Math.random() * 30 - 15; // Adjust based on your octree bounds
    target.mesh.position.set(randomX, randomY, randomZ);
    target.collider.center.set(randomX, randomY, randomZ); // Update the collider
    //let targetOnFloor = false;
    let result = worldOctree.sphereIntersect(target.collider);
    if (result) { // If The Target Is Inside A Wall, Move It Out By The Penetration Depth
        target.collider.center.add(result.normal.multiplyScalar(result.depth));
        checkTargetWallCollisions(target, worldOctree); // Recursively Check Again In Case The New Position Is Also Invalid    
    }
}

function teleportPlayerIfOob(camera, playerCollider, npcCollider, npc) {
    if (npc.mesh.position.y <= -25) {
        console.log("NPC fell out of bounds. Resetting position.");
        npcCollider.start.set( 5, 5, 5 );
        npcCollider.end.set( 5, 6, 5 );
        npcCollider.radius = 0.35;
        npc.mesh.position.copy( npc.getCenter() );
        //endGame(); // Call the game-over function
    }
    if ( camera.position.y <= -25 ) {
        console.log("Player fell out of bounds. Resetting position.");
        playerCollider.start.set( 0, 0.35, 0 );
        playerCollider.end.set( 0, 1, 0 );
        playerCollider.radius = 0.35;
        camera.position.copy( playerCollider.end );
        camera.rotation.set( 0, 0, 0 );
        //endGame(); // Call the game-over function
    }
}
function throwBall(spheres, sphereIdx, camera, playerCollider, playerVelocity, playerDirection, mouseTime) {
    const sphere = spheres[ sphereIdx ];
    sphere.mesh.visible = true;
    camera.getWorldDirection( playerDirection );
    sphere.collider.center.copy( playerCollider.end ).addScaledVector( playerDirection, playerCollider.radius * 1.5 );
    // Throw The Ball With More Force If We Hold The Button Longer, And If We Move Forward
    const impulse = 50 + 100 * ( 1 - Math.exp( ( mouseTime - performance.now() ) * 0.001 ) );
    sphere.velocity.copy( playerDirection ).multiplyScalar( impulse );
    sphere.velocity.addScaledVector( playerVelocity, 2 );
    sphereIdx = ( sphereIdx + 1 ) % spheres.length;
}
export { updatePlayer, updateSpheres, teleportPlayerIfOob, throwBall, updateEnemiesAndTargets, checkBallTargetCollisions, checkForEnemyCollisions, playerCollisions};