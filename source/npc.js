import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

export class NPC {
    constructor({
        scene,
        startPos = new THREE.Vector3(),
        behavior = {
            // Base behavior parameters that can be tweaked for different NPC personalities
            jumpFrequency: 2.1, // seconds between jumps
            ballThrowPower: 60.1, // velocity multiplier for thrown balls
            ballThrowFrequency: 3.1, // seconds between throws
            targetSelectionRadius: 15.1, // max distance to select targets
            enemyAvoidanceDistance: 7.1, // distance to avoid enemies
            movementSpeedMultiplier: 2.1 // multiplier for base speed
        },
        //genome,
        modelOptions = {}
    }) {
        this.scene = scene;
        this.behavior = behavior;
        // Capsule collider like player
        const height = 1.0;
        const radius = 0.35;
        this.collider = new Capsule(
            new THREE.Vector3(0.6, 0.35, 0.6),
            //new THREE.Vector3(startPos.x, startPos.y, startPos.z),
            //new THREE.Vector3(startPos.x, height, startPos.z),
            new THREE.Vector3(0.6, height, 0.6),
            radius
        );

        // Mesh for visibility
        this.mesh = new THREE.Mesh(
            modelOptions.geometry || new THREE.BoxGeometry(0.6, height, 0.6),
            modelOptions.material || new THREE.MeshStandardMaterial({ color: 0x3366ff })
        );
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.position.copy(startPos);
        this.scene.add(this.mesh);

        this.velocity = new THREE.Vector3();
        this.onFloor = false;
        this.targetIndex = -1;
        this.lastBallIndex = 0;
        this.lastJump = 0;
        this.lastThrow = 0;
        this.jumpCount = 0;
        this.baseSpeed = 2.5; // base movement speed
        this.timeSurvived = 0; // For fitness evaluation
        this.targetsHit = 0; // For fitness evaluation
        this.framesSafeDistance = 0; // For fitness evaluation
        this.totalFrames = 0; // For fitness evaluation
        this.actionLatencies = []; // For fitness evaluation
        this.lastActionLatency = 0;
        this.measuredJumpFrequency = 0; // For fitness evaluation
        this.turnSpeed = Math.PI; // Radians per second for turning towards targets for Fitness evaluation
    }
    getCenter(out = new THREE.Vector3()) {
        return out.copy(this.collider.start).add(this.collider.end).multiplyScalar(0.5);
    }
    update(delta, worldOctree, targets, enemies, spawnBallFn, time, GRAVITY = 30) {
        const center = this.getCenter();
        // Select target within radius
        if (this.targetIndex < 0 || !targets[this.targetIndex] ||
            center.distanceTo(targets[this.targetIndex].collider.center) > this.behavior.targetSelectionRadius) {
            this.targetIndex = this.findNearestTarget(center, targets, this.behavior.targetSelectionRadius);
        }
        // Calculate movement direction
        let moveDir = new THREE.Vector3();
        if (this.targetIndex >= 0) {
            const target = targets[this.targetIndex];
            moveDir = target.collider.center.clone().sub(center).normalize();
        }
        // Avoid enemies
        if (enemies && enemies.length > 0) {
            for (const enemy of enemies) {
                const dist = center.distanceTo(enemy.collider.center);
                if (dist < this.behavior.enemyAvoidanceDistance) {
                    const avoidDir = center.clone().sub(enemy.collider.center).normalize();
                    moveDir.add(avoidDir.multiplyScalar(0.5)); // blend avoidance
                }
            }
            moveDir.normalize();
        }
        // Apply movement speed
        const speed = this.baseSpeed * this.behavior.movementSpeedMultiplier;
        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;
        // Jumping
        if (this.onFloor && (time - this.lastJump) > this.behavior.jumpFrequency) {
            this.velocity.y = 20; // jump impulse
            this.lastJump = time;
            this.jumpCount += 1;
            this.onFloor = false;
            //this.velocity.y -= GRAVITY * delta;
        }
        // Gravity
        if (!this.onFloor) {
            this.velocity.y -= GRAVITY * delta;
            console.log("NPC is IN THE AIR applying gravity!");
        } else {
            this.velocity.y = 0;
            console.log("NPC is ON THE GROUND! Setting downward velocity to ZERO.");
        }
        //DEBUG LINES: verify current state of NPC behavior parameters and velocity vector
        //console.log("Checking for current NPC y velocity: ", this.velocity.y);
        //console.log("NPC: >>>>>", this.behavior);
        // DEBUG: Check if worldOctree exists
        if (!worldOctree) {
        console.error("NPC: worldOctree is null or undefined!");
        return;
        }
        // Update collider position (FIXED: proper capsule update)
        const deltaPos = this.velocity.clone().multiplyScalar(delta);
        this.collider.translate(deltaPos); // Use translate() method like player does
        // Collision with world
        const result = worldOctree.capsuleIntersect(this.collider);
        //DEBUG LINE
        //console.log("Logging whether the player is on the floor before gravity is applied:>>>>>>", result);
        // DEBUG: Log collision results
        if (time % 1 < delta) {
        console.log(`Collision result:`, result ? "HIT" : "MISS");
        }
        this.onFloor = false;
        if (result) {
            this.onFloor = result.normal.y > 0;
            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
            }
            if (result.depth >= 1e-10) {
                this.collider.translate(result.normal.multiplyScalar(result.depth));
            }
        }
        // Sync mesh
        this.mesh.position.copy(this.getCenter());
        //
        if (this.isNpcFarFromAllEnemies(enemies)) {
            this.framesSafeDistance += 1;
        }
        // Throwing balls
        if (time - this.lastThrow > this.behavior.ballThrowFrequency && this.targetIndex >= 0) {
            this.lastThrow = time;
            const spawnPos = center.clone().add(new THREE.Vector3(0, 0.9, 0));
            const target = targets[this.targetIndex];
            const dir = target.collider.center.clone().sub(spawnPos).normalize();
            const velocity = dir.multiplyScalar(this.behavior.ballThrowPower);
            //if (spawnBallFn) spawnBallFn(spawnPos, velocity);
            this.lastBallIndex = spawnBallFn ? spawnBallFn(spawnPos, velocity) : this.lastBallIndex; // Store index of thrown ball for potential tracking
        }
    }
    isNpcFarFromAllEnemies(enemies) {
        return enemies.every(e => this.getCenter().distanceTo(e.collider.center) >= this.enemyAvoidanceDistance);
    }
    findNearestTarget(center, targets, maxDist) {
        let nearest = -1;
        let minDist = maxDist;
        for (let i = 0; i < targets.length; i++) {
            const dist = center.distanceTo(targets[i].collider.center);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }
        return nearest;
    }
}