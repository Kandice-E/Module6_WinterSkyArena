import * as THREE from 'three';

export class NPC {
    constructor({
        scene,
        startPosition = new THREE.Vector3(),
        geometry = null,
        material = null,
        colliderRadius = 0.35,
        behaviorGenome = new THREE.Vector3(0, 0, 0)})
        {
            this.scene = scene;
            this.behaviorGenome = behaviorGenome;
            this.velocity = new THREE.Vector3();
            //Create a visible mesh for the NPC
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.mesh.position.copy(startPosition);
            //this.scene.add(this.mesh);
            //Create a collider for NPC collision detection
            this.collider = new THREE.Sphere(startPosition.clone(), colliderRadius);
            //Store initial position for reference
            this.position = startPosition.clone();
        }
        //Update NPC behavior based on its genome (simple example: move in a direction defined by the genome)
        updateBehavior(deltaTime) {
            //Apply behavior genome to determine velocity
            this.velocity.x = Math.cos(this.behaviorGenome.z) * this.behaviorGenome.x;
            this.velocity.y = this.behaviorGenome.y;
            this.velocity.z = Math.sin(this.behaviorGenome.z) * this.behaviorGenome.x;
        }
        //Update NPC position based on velocity and check for collisions (called in physics loop)
        update(deltaTime) {
            this.updateBehavior(deltaTime);
            //Update position based on velocity
            this.position.addScaledVector(this.velocity, deltaTime);
            //Sync collider and mesh position with the updated NPC position
            this.collider.center.copy(this.position);
            this.mesh.position.copy(this.position);
        }
        //Check collision with another collider (e.g., player or other NPCs)
        checkCollisionWith(otherCollider) {
            const distance = this.collider.center.distanceTo(otherCollider.center);
            const minDistance = this.collider.radius + otherCollider.radius;
            return distance < minDistance;
        }
        //Get the center position of the NPC (useful for various calculations)
        getCenter() {
            return this.position.clone();
        }
        //Set the behavior genome for the NPC (can be used to change behavior dynamically)
        setBehaviorGenome(x, y, z) {
            this.behaviorGenome.set(x, y, z);
        }
        //Remove NPC from the scene and clean up resources
        remove() {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
}