import * as THREE from 'three';
import { addControls, controls, eventListeners } from './controls.js'; 
import { updatePlayer, updateSpheres, teleportPlayerIfOob, updateEnemies, checkPlayerEnemyCollisions, checkBallTargetCollisions } from './gamePhysics.js';
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import { addLights } from './lights.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';

//-----GLOBAL VARIABLES FOR IMPORT FUNCTIONS-----//
const keyStates = {};
let mouseTime = 0;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = { onFloor: false };
const GRAVITY = 30;
const NUM_SPHERES = 10;
const SPHERE_RADIUS = 0.2;
const spheres = [];
let sphereIdx = 0;
const NUM_ENEMIES = 50; // Number of enemies
const ENEMY_RADIUS = 0.5; // Radius of enemy collider
const enemies = []; // Array to store enemies
const enemyBounds = { minY: -2, maxY: 10};
const NUM_TARGETS = 10; // Number of targets
const TARGET_RADIUS = 0.5; // Size of the sphere target
const targets = []; // Array to store targets
let score = {counter: 0}; // Initialize score counter
const playerCollider = new Capsule( new THREE.Vector3( 0, 0.35, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.35 );
const worldOctree = new Octree();
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();
//-----SETUP-----//
const clock = new THREE.Clock();
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
//Add FPS stats
const stats = Stats();
document.body.appendChild(stats.dom);
//-----HANDLE WINDOW RESIZING-----//
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onWindowResize, false);
//-----ADD SPHERES-----//
const sphereGeometry = new THREE.IcosahedronGeometry( SPHERE_RADIUS, 5 );
const sphereMaterial = new THREE.MeshBasicMaterial( { color: 0xdede8d } );
for ( let i = 0; i < NUM_SPHERES; i ++ ) {
    const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add( sphere );
    spheres.push( {
        mesh: sphere,
        collider: new THREE.Sphere( new THREE.Vector3( 0, - 100, 0 ), SPHERE_RADIUS ),
        velocity: new THREE.Vector3()
    } );
}
//-----ADD ENEMIES-----//
const enemyGeometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for enemies
for (let i = 0; i < NUM_ENEMIES; i++) {
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    enemy.castShadow = true;
    enemy.receiveShadow = true;
    scene.add(enemy);
    // Place enemies randomly within the octree bounds
    const randomX = Math.random() * 30 - 10; // Adjust based on your octree bounds
    const randomY = Math.random() * 5 + 1;   // Adjust based on your octree bounds
    const randomZ = Math.random() * 30 - 10; // Adjust based on your octree bounds
    enemies.push({
        mesh: enemy,
        collider: new THREE.Sphere(new THREE.Vector3(randomX, randomY, randomZ), ENEMY_RADIUS),
        velocity: new THREE.Vector3(0, Math.random() * 2 + 1, 0), // Random movement
        direction: 1, // 1 for moving up, -1 for moving down
    });    
}
//-----ADD TARGETS-----//
const targetGeometry = new THREE.SphereGeometry(TARGET_RADIUS, 16, 16);
const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green color for targets
for (let i = 0; i < NUM_TARGETS; i++) {
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.castShadow = true;
    target.receiveShadow = true;
    scene.add(target);
    // Place targets randomly within the octree bounds
    const randomX = Math.random() * 30 - 10; // Adjust based on your octree bounds
    const randomY = Math.random() * 2;  // Adjust based on your octree bounds
    const randomZ = Math.random() * 30 - 10; // Adjust based on your octree bounds
    target.position.set(randomX, randomY, randomZ);
    targets.push({
        mesh: target,
        collider: new THREE.Sphere(new THREE.Vector3(randomX, randomY, randomZ), TARGET_RADIUS),
    });
}
//-----ADD SCORE DISPLAY-----//
const scoreDisplay = document.createElement('div');
scoreDisplay.id = 'score'; // Add an ID for easy access
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '10px';
scoreDisplay.style.right = '10px';
scoreDisplay.style.color = 'white';
scoreDisplay.style.fontSize = '24px';
scoreDisplay.innerText = `Score: ${score.counter}`;
document.body.appendChild(scoreDisplay);
//-----UPDATE SCORE DISPLAY-----//
export function updateScoreDisplay(score) {
    console.log("Score updated:", score.counter); // Debugging line
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        console.log("Score element found!"); // Debugging line
        scoreElement.innerText = `Score: ${score.counter}`;
    } else {
        console.error("Score element not found!");
    }
}
//-----ADD EVENT LISTENERS FOR CONTROLS-----//
eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection, playerOnFloor);
//-----FOG-----//
scene.fog = new THREE.Fog(0x100000, 0, 35);
//-----LIGHTS-----//
//addLights(scene);
//-----CONTROLS-----//
//const orbitControls = addControls(camera, renderer.domElement);
//-----SKYBOX-----//
new RGBELoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    //scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
//-----LOAD MODEL-----//
const loader = new GLTFLoader();
loader.load('./assets/collision-world.glb', ( gltf ) => {
        //gltf.scene.scale.set(30, 30, 30);
        //gltf.scene.position.y = 50;
        scene.add( gltf.scene );
        worldOctree.fromGraphNode( gltf.scene );
        gltf.scene.traverse( ( child ) => {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.color.set(0xFC98A8);
                if ( child.material.map ) {
                    child.material.map.anisotropy = 4;
                }
            }
        });
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                console.log('Mesh name:', child.name);
            }
        });
    });
//-----OCTREE HELPER-----//
const helper = new OctreeHelper( worldOctree, 'crimson' );
helper.visible = true;
scene.add( helper );
//-----SNOWFLAKE SPRITES-----//
const points = addSFPoints();
points.position.set(-23, -4, -23);
scene.add(points);
//-----START GAME-----//
// Create the start screen overlay
const startScreen = document.createElement('div');
startScreen.id = 'start-screen';
startScreen.style.position = 'absolute';
startScreen.style.top = '0';
startScreen.style.left = '0';
startScreen.style.width = '100%';
startScreen.style.height = '100%';
startScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
startScreen.style.display = 'flex';
startScreen.style.flexDirection = 'column';
startScreen.style.justifyContent = 'center';
startScreen.style.alignItems = 'center';
startScreen.style.color = 'white';
startScreen.style.fontSize = '48px';
startScreen.style.zIndex = '10';
// Add a title
const title = document.createElement('div');
title.innerText = 'Welcome to Winter Sky Arena!';
title.style.marginBottom = '20px';
startScreen.appendChild(title);
// Add a start button
const startButton = document.createElement('button');
startButton.innerText = 'Start Game';
startButton.style.padding = '10px 20px';
startButton.style.fontSize = '24px';
startButton.style.cursor = 'pointer';
startButton.style.border = 'none';
startButton.style.borderRadius = '5px';
startButton.style.backgroundColor = '#28a745';
startButton.style.color = 'white';
startButton.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
startButton.style.transition = 'background-color 0.3s';
startScreen.appendChild(startButton);
// Append the start screen to the document body
document.body.appendChild(startScreen);
// Add hover effects for the start button
startButton.addEventListener('mouseover', () => {
    startButton.style.backgroundColor = '#218838';
});
startButton.addEventListener('mouseout', () => {
    startButton.style.backgroundColor = '#28a745';
});
// Start the game when the button is clicked
startButton.addEventListener('click', () => {
    startScreen.style.display = 'none'; // Hide the start screen
    animate(); // Start the game loop
});
//-----GAME ANIMATION LOOP-----//
function animate() {
    console.log("Animation loop running...");
    requestAnimationFrame(animate);
    animatePoints(points);
    const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;
    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.
    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
        controls(keyStates, playerVelocity, camera, playerDirection, deltaTime, playerOnFloor);
        updatePlayer(deltaTime, playerOnFloor, playerVelocity, playerCollider, worldOctree, GRAVITY, camera);
        updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, playerCollider, playerVelocity, vector1, vector2, vector3);
        updateEnemies(deltaTime, enemies, enemyBounds); // Update enemies within the octree
        checkPlayerEnemyCollisions(playerCollider, enemies); // Check for collisions
        checkBallTargetCollisions(spheres, targets, score); // Check for collisions with targets
        teleportPlayerIfOob(camera, playerCollider);
    }
    stats.update();
    renderer.render(scene, camera);
};
//animate();
//-----END GAME-----//
/*export function endGame() {
    // Stop the animation loop
    cancelAnimationFrame(animate);
    // Display a game-over message
    const gameOverMessage = document.createElement('div');
    gameOverMessage.style.position = 'absolute';
    gameOverMessage.style.top = '50%';
    gameOverMessage.style.left = '50%';
    gameOverMessage.style.transform = 'translate(-50%, -50%)';
    gameOverMessage.style.color = 'white';
    gameOverMessage.style.fontSize = '48px';
    gameOverMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverMessage.style.padding = '20px';
    gameOverMessage.style.borderRadius = '10px';
    gameOverMessage.innerText = 'Game Over!';
    document.body.appendChild(gameOverMessage);
}*/
export function endGame() {
    // Stop the animation loop
    cancelAnimationFrame(animate);
    // Create a game-over overlay
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'game-over-screen';
    gameOverScreen.style.position = 'absolute';
    gameOverScreen.style.top = '0';
    gameOverScreen.style.left = '0';
    gameOverScreen.style.width = '100%';
    gameOverScreen.style.height = '100%';
    gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverScreen.style.display = 'flex';
    gameOverScreen.style.flexDirection = 'column';
    gameOverScreen.style.justifyContent = 'center';
    gameOverScreen.style.alignItems = 'center';
    gameOverScreen.style.color = 'white';
    gameOverScreen.style.fontSize = '48px';
    gameOverScreen.style.zIndex = '10';
    // Add a "Game Over" message
    const gameOverMessage = document.createElement('div');
    gameOverMessage.innerText = 'Game Over!';
    gameOverMessage.style.marginBottom = '20px';
    gameOverScreen.appendChild(gameOverMessage);
    // Display the final score
    const finalScore = document.createElement('div');
    finalScore.innerText = `Final Score: ${score.counter}`;
    finalScore.style.marginBottom = '20px';
    gameOverScreen.appendChild(finalScore);
    // Add a "Restart Game" button
    const restartButton = document.createElement('button');
    restartButton.innerText = 'Restart Game';
    restartButton.style.padding = '10px 20px';
    restartButton.style.fontSize = '24px';
    restartButton.style.cursor = 'pointer';
    restartButton.style.border = 'none';
    restartButton.style.borderRadius = '5px';
    restartButton.style.backgroundColor = '#28a745';
    restartButton.style.color = 'white';
    restartButton.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    restartButton.style.transition = 'background-color 0.3s';
    gameOverScreen.appendChild(restartButton);
    // Append the game-over screen to the document body
    document.body.appendChild(gameOverScreen);
    // Add hover effects for the restart button
    restartButton.addEventListener('mouseover', () => {
        restartButton.style.backgroundColor = '#218838';
    });
    restartButton.addEventListener('mouseout', () => {
        restartButton.style.backgroundColor = '#28a745';
    });
    // Restart the game when the button is clicked
    restartButton.addEventListener('click', () => {
        console.log("Restart button clicked.");
        document.body.removeChild(gameOverScreen); // Remove the game-over screen
        restartGame(); // Call the restart function
    });
}
//-----RESTART GAME-----//
function restartGame() {
    // Reset the score
    score.counter = 0;
    updateScoreDisplay(score);
    // Reset player position and velocity
    playerCollider.start.set(0, 0.35, 0);
    playerCollider.end.set(0, 1, 0);
    playerVelocity.set(0, 0, 0);
    // Reset spheres
    spheres.forEach(sphere => {
        sphere.mesh.visible = false;
        sphere.collider.center.set(0, -100, 0); // Move spheres out of the scene
        sphere.velocity.set(0, 0, 0);
    });
    // Reset enemies
    enemies.forEach(enemy => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 5 + 1;
        const randomZ = Math.random() * 30 - 10;
        enemy.collider.center.set(randomX, randomY, randomZ);
        enemy.mesh.position.copy(enemy.collider.center);
        enemy.velocity.set(0, Math.random() * 2 + 1, 0);
        enemy.direction = 1;
    });
    // Reset targets
    targets.forEach(target => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 2;
        const randomZ = Math.random() * 30 - 10;
        target.collider.center.set(randomX, randomY, randomZ);
        target.mesh.position.set(randomX, randomY, randomZ);
    });
    // Restart the game loop
    animate();
}