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

            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.castShadow = true;
            this.mesh.receiveShadow = true;
            this.mesh.position.copy(startPosition);
            //this.scene.add(this.mesh);

            this.collider = new THREE.Sphere(startPosition.clone(), colliderRadius);
            this.position = startPosition.clone();
        }

        updateBehavior(deltaTime) {
            this.velocity.x = Math.cos(this.behaviorGenome.z) * this.behaviorGenome.x;
            this.velocity.y = this.behaviorGenome.y;
            this.velocity.z = Math.sin(this.behaviorGenome.z) * this.behaviorGenome.x;
        }

        update(deltaTime) {
            this.updateBehavior(deltaTime);

            this.position.addScaledVector(this.velocity, deltaTime);

            this.collider.center.copy(this.position);
            this.mesh.position.copy(this.position);
        }
        checkCollisionWith(otherCollider) {
            const distance = this.collider.center.distanceTo(otherCollider.center);
            const minDistance = this.collider.radius + otherCollider.radius;
            return distance < minDistance;
        }

        getCenter() {
            return this.position.clone();
        }

        setBehaviorGenome(x, y, z) {
            this.behaviorGenome.set(x, y, z);
        }

        remove() {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
}