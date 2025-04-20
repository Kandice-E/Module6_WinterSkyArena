import * as THREE from 'three';
import { controls, eventListeners } from './controls.js'; 
import { updatePlayer, updateSpheres, teleportPlayerIfOob, updateEnemies, checkPlayerEnemyCollisions, checkBallTargetCollisions } from './gamePhysics.js';
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
// Checking Changes
//-----GLOBAL VARIABLES FOR IMPORT FUNCTIONS-----//
const keyStates = {}; // Object to store key states
let mouseTime = 0;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = { onFloor: false };
const GRAVITY = 30;
const NUM_SPHERES = 10;
const SPHERE_RADIUS = 0.2; // Radius of sphere collider
const spheres = [];
let sphereIdx = 0;
const NUM_ENEMIES = 50;
const ENEMY_RADIUS = 0.5; // Radius of enemy collider
const enemies = [];
const enemyBounds = { minY: -2, maxY: 10};
const NUM_TARGETS = 10;
const TARGET_RADIUS = 0.5;
const targets = [];
let score = {counter: 0}; // Initialize score counter
const playerCollider = new Capsule( new THREE.Vector3( 0, 0.35, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.35 );
const worldOctree = new Octree(); // Create a new Octree for the world
const vector1 = new THREE.Vector3(); // Vector for collision detection
const vector2 = new THREE.Vector3(); // Vector for collision detection
const vector3 = new THREE.Vector3(); // Vector for collision detection
//-----END GLOBAL VARIABLES-----//

//-----SETUP-----//
const clock = new THREE.Clock();
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const stats = Stats();
document.body.appendChild(stats.dom);
// Handle Window Resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onWindowResize, false);
scene.fog = new THREE.Fog(0x100000, 0, 35);
//-----END SETUP-----//

//-----ADD GAME OBJECTS-----//
// Add Spheres
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
// Add Enemies
const enemyGeometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for enemies
for (let i = 0; i < NUM_ENEMIES; i++) {
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    enemy.castShadow = true;
    enemy.receiveShadow = true;
    scene.add(enemy);
    // Place Enemies Randomly Within The Octree Bounds
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
// Add Targets
const targetGeometry = new THREE.SphereGeometry(TARGET_RADIUS, 16, 16);
const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green color for targets
for (let i = 0; i < NUM_TARGETS; i++) {
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.castShadow = true;
    target.receiveShadow = true;
    scene.add(target);
    // Place Targets Randomly Within The Octree Bounds
    const randomX = Math.random() * 30 - 10; // Adjust based on your octree bounds
    const randomY = Math.random() * 2;  // Adjust based on your octree bounds
    const randomZ = Math.random() * 30 - 10; // Adjust based on your octree bounds
    target.position.set(randomX, randomY, randomZ);
    targets.push({
        mesh: target,
        collider: new THREE.Sphere(new THREE.Vector3(randomX, randomY, randomZ), TARGET_RADIUS),
    });
}
// Add Lights Using Skybox
new RGBELoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    //scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
// Load Game Model
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
// Add Snowflake Points
const points = addSFPoints();
points.position.set(-23, -4, -23);
scene.add(points);
//-----END ADD GAME OBJECTS-----//

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
// Update Score Display Function
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
//-----END ADD SCORE DISPLAY-----//

//-----START GAME-----//
// Initialize Event Listeners For Controls
eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection, playerOnFloor);
// Create The Start Screen Overlay
const startScreen = document.createElement('div');
startScreen.id = 'start-screen';
startScreen.style.position = 'absolute';
startScreen.style.top = '0';
startScreen.style.left = '0';
startScreen.style.width = '100%';
startScreen.style.height = '100%';
startScreen.style.backgroundImage = 'url("./assets/WinterSkyArena2.png")';
startScreen.style.backgroundSize = 'cover'; // Ensures the image covers the entire screen
startScreen.style.backgroundPosition = 'center'; // Centers the image
startScreen.style.backgroundRepeat = 'no-repeat'; // Prevents the image from repeating
startScreen.style.display = 'flex';
startScreen.style.flexDirection = 'column';
startScreen.style.justifyContent = 'center';
startScreen.style.alignItems = 'center';
startScreen.style.color = 'white';
startScreen.style.fontSize = '48px';
startScreen.style.zIndex = '10';
// Add A Title
const title = document.createElement('div');
title.innerText = 'Welcome to Winter Sky Arena!';
title.style.marginBottom = '20px';
startScreen.appendChild(title);
// Add A Start Button
const startButton = document.createElement('button');
startButton.id = 'start-button';
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
// Append The Start Screen To The Document Body
document.body.appendChild(startScreen);
// Add Hover Effects For The Start Button
startButton.addEventListener('mouseover', () => {
    startButton.style.backgroundColor = '#218838';
});
startButton.addEventListener('mouseout', () => {
    startButton.style.backgroundColor = '#28a745';
});
// Start The Game When The Button Is Clicked
startButton.addEventListener('click', () => {
    if (document.pointerLockElement) {
        console.log("Pointer lock is active. Disabling it now...");
        document.exitPointerLock();
    } else {
        console.log("Pointer lock is not active.");
    }
    startScreen.style.display = 'none'; // Hide the start screen
    animate(); // Start the game loop
});
//-----END START GAME-----//

//-----GAME ANIMATION LOOP-----//
let animationFrameId; // Global variable to store the animation frame ID
function animate() {
    console.log("Animation loop running...");
    animationFrameId = requestAnimationFrame(animate); // Store the frame ID
    //requestAnimationFrame(animate);
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
//-----END GAME ANIMATION LOOP-----//

//-----GAME OVER-----//
export function endGame() {
    // Stop The Animation Loop
    cancelAnimationFrame(animationFrameId); // Stop the animation loop
    // Create A Game-Over Overlay
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'game-over-screen';
    gameOverScreen.style.position = 'absolute';
    gameOverScreen.style.top = '0';
    gameOverScreen.style.left = '0';
    gameOverScreen.style.width = '100%';
    gameOverScreen.style.height = '100%';
    gameOverScreen.style.backgroundImage = 'url("./assets/WinterSkyArena1.png")';
    gameOverScreen.style.backgroundSize = 'cover'; // Ensures the image covers the entire screen
    gameOverScreen.style.backgroundPosition = 'center'; // Centers the image
    gameOverScreen.style.backgroundRepeat = 'no-repeat'; // Prevents the image from repeating
    gameOverScreen.style.display = 'flex';
    gameOverScreen.style.flexDirection = 'column';
    gameOverScreen.style.justifyContent = 'center';
    gameOverScreen.style.alignItems = 'center';
    gameOverScreen.style.color = 'white';
    gameOverScreen.style.fontSize = '48px';
    gameOverScreen.style.zIndex = '10';
    // Add A "Game Over" Message
    const gameOverMessage = document.createElement('div');
    gameOverMessage.innerText = 'Game Over!';
    gameOverMessage.style.marginBottom = '20px';
    gameOverScreen.appendChild(gameOverMessage);
    // Display The Final Score
    const finalScore = document.createElement('div');
    finalScore.innerText = `Final Score: ${score.counter}`;
    finalScore.style.marginBottom = '20px';
    gameOverScreen.appendChild(finalScore);
    // Add A "Restart Game" Button
    const restartButton = document.createElement('button');
    restartButton.id = 'restart-button';
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
    // Append The Game-Over Screen To The Document Body
    document.body.appendChild(gameOverScreen);
    // Add Hover Effects For The Restart Button
    restartButton.addEventListener('mouseover', () => {
        restartButton.style.backgroundColor = '#218838';
    });
    restartButton.addEventListener('mouseout', () => {
        restartButton.style.backgroundColor = '#28a745';
    });
    // Restart The Game When The Button Is Clicked
    restartButton.addEventListener('click', () => {
        console.log("Restart button clicked.");
    
        if (document.pointerLockElement) {
            console.log("Pointer lock is active. Disabling it now...");
            document.exitPointerLock();
        } else {
            console.log("Pointer lock is not active.");
        }
        restartGame();
    });
}
//-----RESTART GAME-----//
function restartGame() {
    console.log("Restarting game..."); // Debugging line
    // Remove the game over screen if it exists
    const gameOverScreen = document.getElementById('game-over-screen');
    if (gameOverScreen) {
        document.body.removeChild(gameOverScreen);
        console.log("Game over screen removed.");
    }
    // Reset The Score
    score.counter = 0;
    updateScoreDisplay(score);
    // Reset Player Position And Velocity
    playerCollider.start.set(0, 0.35, 0);
    playerCollider.end.set(0, 1, 0);
    playerVelocity.set(0, 0, 0);
    // Reset Spheres
    spheres.forEach(sphere => {
        sphere.mesh.visible = false;
        sphere.collider.center.set(0, -100, 0); // Move spheres out of the scene
        sphere.velocity.set(0, 0, 0);
    });
    // Reset Enemies
    enemies.forEach(enemy => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 5 + 1;
        const randomZ = Math.random() * 30 - 10;
        enemy.collider.center.set(randomX, randomY, randomZ);
        enemy.mesh.position.copy(enemy.collider.center);
        enemy.velocity.set(0, Math.random() * 2 + 1, 0);
        enemy.direction = 1;
    });
    // Reset Targets
    targets.forEach(target => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 2;
        const randomZ = Math.random() * 30 - 10;
        target.collider.center.set(randomX, randomY, randomZ);
        target.mesh.position.set(randomX, randomY, randomZ);
    });
    startScreen.style.display = 'flex'; // Show the start screen again
}