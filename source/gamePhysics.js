import * as THREE from 'three';
import { endGame, updateScoreDisplay, continueRound, collisionState, COLLISION_COOLDOWN } from './main.js';

function updatePlayer(deltaTime, worldOctree, GRAVITY, camera, player) {
    let damping = Math.exp( - 4 * deltaTime ) - 1;
    if (!player.onFloor) {
        player.velocity.y -= GRAVITY * deltaTime;
        damping *= 0.1;
    }
    player.velocity.addScaledVector(player.velocity, damping);
    const deltaPosition = player.velocity.clone().multiplyScalar(deltaTime);
    player.collider.translate(deltaPosition);
    playerCollisions(worldOctree, player);
    camera.position.copy(player.collider.end);
}
function playerCollisions(worldOctree, player) {
    /*if (player !== undefined && player !== null){
        console.log("<<<<<<<<<<Player is DEFINED!>>>>>>>>>>");
        console.log("Player Collider: ", player.collider);
    }
    else{
        console.log("<<<<<<<<<Player IS NOT defined!>>>>>>>>>>");
    }*///Debugging player undefined errors
    const result = worldOctree.capsuleIntersect(player.collider);
    player.onFloor = false;
    if (result) {
        player.onFloor = result.normal.y > 0;
        if (!player.onFloor) {
            player.velocity.addScaledVector( result.normal, - result.normal.dot(player.velocity));
        }
        if (result.depth >= 1e-10 ) {
            player.collider.translate( result.normal.multiplyScalar( result.depth));
        }
    }
}
function updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, vector1, vector2, vector3, player ) {
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
        playerSphereCollision( sphere, vector1, vector2, vector3, player );
    } );
    spheresCollisions(spheres, vector1, vector2, vector3);
    for ( const sphere of spheres ) {
        sphere.mesh.position.copy( sphere.collider.center );
    }
}
function playerSphereCollision(sphere, vector1, vector2, vector3, player) {
    
    const center = vector1.addVectors(player.collider.start, player.collider.end).multiplyScalar(0.5);
    const sphere_center = sphere.collider.center;
    const r = player.collider.radius + sphere.collider.radius;
    const r2 = r * r;
    for (const point of [ player.collider.start, player.collider.end, center]) {
        const d2 = point.distanceToSquared(sphere_center);
        if (d2<r2){
            const normal = vector1.subVectors( point, sphere_center ).normalize();
            const v1 = vector2.copy( normal ).multiplyScalar( normal.dot( player.velocity ) );
            const v2 = vector3.copy( normal ).multiplyScalar( normal.dot( sphere.velocity ) );
            player.velocity.add( v2 ).sub( v1 );
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
function checkForEnemyCollisions(npcCollider, enemies, camera, player, score, npc) {
    const currentTime = performance.now() / 1000;
    for (const enemy of enemies) {
        const distance1 = npcCollider.start.distanceTo(enemy.collider.center);
        const distance2 = player.collider.start.distanceTo(enemy.collider.center);
        const combinedRadius1 = npcCollider.radius + enemy.collider.radius;
        const combinedRadius2 = player.collider.radius + enemy.collider.radius;
        if (distance1 < combinedRadius1) {
            if (currentTime - collisionState.lastPlayerEnemyCollisionTime < COLLISION_COOLDOWN) {
                return; // Skip collision handling if we're still in the cooldown period
            }
            //console.log("NPC collided with an enemy. Resetting position. MINUS 1 POINT!");
            collisionState.lastPlayerEnemyCollisionTime = currentTime; // Update the last collision time
            npcCollider.start.set( 0, 0.35, 0 );
            npcCollider.end.set( 0, 1, 0 );
            npcCollider.radius = 0.35;
            npc.score -= 1;
            score.npcCounter -= 1;
            updateScoreDisplay(score);
            // Future update could decrement npc number of lives
            // and end game once lives equal zero.
        }
        if (distance2 < combinedRadius2) {
            if (currentTime - collisionState.lastPlayerEnemyCollisionTime < COLLISION_COOLDOWN) {
                return; // Skip collision handling if we're still in the cooldown period
            }
            //console.log("Player collided with an enemy. Resetting position. MINUS 1 POINT!");
            collisionState.lastPlayerEnemyCollisionTime = currentTime; // Update the last collision time
            player.collider.start.set( 0, 0.35, 0 );
            player.collider.end.set( 0, 1, 0 );
            player.collider.radius = 0.35;
            camera.position.copy( player.collider.end );
            camera.rotation.set( 0, 0, 0 );
            player.score -= 1;
            score.counter -= 1;
            updateScoreDisplay(score);
            // Future update could decrement npc number of lives
            // and end game once lives equal zero.
        }
    }
}
function checkBallTargetCollisions(spheres, targets, score, npcs, worldOctree, player, playerStats) {
    spheres.forEach (sphere => {
        for (const target of targets) {
            const distance = sphere.collider.center.distanceTo(target.collider.center);
            const combinedRadius = sphere.collider.radius + target.collider.radius;
            if (distance < combinedRadius) {
                // Check if an NPC threw this ball
                if (sphere.throwerNpcIndex >= 0 && sphere.throwerNpcIndex < npcs.length) {
                    const npc = npcs[sphere.throwerNpcIndex];
                    if (target === targets[npc.targetIndex]) {
                        // NPC hit its target
                        console.log(`NPC ${sphere.throwerNpcIndex} hit a target!`);
                        score.npcCounter += 1;
                        npc.score += 1;
                        npc.targetsHit += 1;
                    } else {
                        // NPC hit wrong target, player gets points
                        console.log("Player hit a target!");
                        score.counter += 1;
                        player.score += 1;
                        if (playerStats) {
                            playerStats.targetsHit += 1;
                        }
                        npc.targetIndex = -1; // Force NPC to pick new target
                    }
                } else {
                    // Player threw this ball
                    console.log("Player hit a target!");
                    score.counter += 1;
                    player.score += 1;
                    if (playerStats) {
                        playerStats.targetsHit += 1;
                    }
                }
                updateScoreDisplay(score);
                checkTargetWallCollisions(target, worldOctree);
                break;
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
function teleportPlayerIfOob(camera, npcCollider, npc, player) {
    if (npcCollider.start.y <= -25) {
        //console.log("NPC fell out of bounds. Resetting position.");
        npcCollider.start.set( 0.6, 0.35, 0.6 );
        npcCollider.end.set( 0.6, 1, 0.6 );
        npcCollider.radius = 0.35;
        npc.mesh.position.copy( npc.getCenter() );
        //endGame(); // DEBUG LINE: CAN SAFELY REMOVE ONCE DONE WITH TESTING
    }
    if ( camera.position.y <= -25 ) {
        //console.log("Player fell out of bounds. Resetting position.");
        player.collider.start.set( 0, 0.35, 0 );
        player.collider.end.set( 0, 1, 0 );
        player.collider.radius = 0.35;
        camera.position.copy( player.collider.end );
        camera.rotation.set( 0, 0, 0 );
        //endGame(); // DEBUG LINE: CAN SAFELY REMOVE ONCE DONE WITH TESTING
    }
}
function throwBall(spheres, sphereIdx, camera, mouseTime, player) {
    const sphere = spheres[ sphereIdx ];
    sphere.mesh.visible = true;
    camera.getWorldDirection( player.direction );
    sphere.collider.center.copy( player.collider.end ).addScaledVector( player.direction, player.collider.radius * 1.5 );
    // Throw The Ball With More Force If We Hold The Button Longer, And If We Move Forward
    const impulse = 50 + 100 * ( 1 - Math.exp( ( mouseTime - performance.now() ) * 0.001 ) );
    sphere.velocity.copy( player.direction ).multiplyScalar( impulse );
    sphere.velocity.addScaledVector( player.velocity, 2 );
    sphereIdx = ( sphereIdx + 1 ) % spheres.length;
}
export { updatePlayer, updateSpheres, teleportPlayerIfOob, throwBall, updateEnemiesAndTargets, checkBallTargetCollisions, checkForEnemyCollisions, playerCollisions};