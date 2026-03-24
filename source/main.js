import * as THREE from 'three';
import { controls, eventListeners } from './controls.js'; 
import { updatePlayer, updateSpheres, teleportPlayerIfOob, updateEnemiesAndTargets, checkBallTargetCollisions, checkForEnemyCollisions } from './gamePhysics.js';
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';
import { HDRLoader } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Player } from './player.js';
import { NPC} from './npc.js';
// Checking Changes
//-----GLOBAL VARIABLES FOR IMPORT FUNCTIONS-----//
const keyStates = {}; // Object to store key states
let mouseTime = 0;
const STEPS_PER_FRAME = 3;
//const playerVelocity = new THREE.Vector3();
//const playerDirection = new THREE.Vector3();
//let playerOnFloor = { onFloor: false };
//let playerTimeSurvived = 0; // For fitness evaluation
//let playerJumpFrequency = 0; // For fitness evaluation
//let playerTurnSpeed = 0; // For fitness evaluation
const GRAVITY = 30;
const NUM_SPHERES = 10;
const SPHERE_RADIUS = 0.2; // Radius of sphere collider
const spheres = [];
let sphereIdx = 0;
const NUM_ENEMIES = 25;
const ENEMY_RADIUS = 0.5; // Radius of enemy collider
const enemies = [];
const enemyAndTargetBounds = { minY: -2, maxY: 10};
const NUM_TARGETS = 10;
const TARGET_RADIUS = 0.5;
const targets = [];
let score = {counter: 0, npcCounter: 0}; // Initialize score counters
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
// Ensure canvas fills the window to prevent WebGL viewport warnings
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
// Handle Window Resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onWindowResize, false);
// Initial resize to match current window size
onWindowResize();
scene.fog = new THREE.Fog(0x100000, 0, 35);
//-----END SETUP-----//

//-----ADD GAME OBJECTS-----//
// Add Spheres
const loader2 = new THREE.TextureLoader();
const sphereTexture = loader2.load('./assets/snowball.jpg'); // Load the snowflake texture
const sphereGeometry = new THREE.IcosahedronGeometry( SPHERE_RADIUS, 5 );
const sphereMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff } );
for ( let i = 0; i < NUM_SPHERES; i ++ ) {
    const sphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
    sphere.material.map = sphereTexture; // Apply the snowball texture to the sphere
    sphere.material.needsUpdate = true; // Ensure the material updates with the new texture
    sphere.castShadow = false;
    sphere.receiveShadow = true;
    scene.add( sphere );
    spheres.push( {
        mesh: sphere,
        collider: new THREE.Sphere( new THREE.Vector3( 0, - 100, 0 ), SPHERE_RADIUS ),
        velocity: new THREE.Vector3()
    } );
}
// Add NPC ball spawn function (called by NPC behavior when throwing a ball)
function npcSpawnBall(origin, velocity) {
    const s = spheres[sphereIdx];
    s.mesh.visible = true;
    s.collider.center.copy(origin);
    s.mesh.position.copy(origin);
    s.velocity.copy(velocity);
    const ballThrown = sphereIdx; // Store the index of the thrown ball for potential NPC tracking
    sphereIdx = (sphereIdx + 1) % spheres.length;
    return ballThrown; // Return the index of the thrown ball for NPC tracking
}
// Add Enemies
const enemyGeometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for enemies
// Function to initialize and reset enemy positions
function positionEnemies() {
    for (let i = 0; i < NUM_ENEMIES; i++) {
        const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemy.castShadow = false;
        enemy.receiveShadow = true;
        scene.add(enemy);
        // Place Enemies Randomly Within The Octree Bounds, avoiding player spawn area
        let randomX, randomY, randomZ, dist;
        do {
            randomX = Math.random() * 30 - 10; // Adjust based on your octree bounds
            randomY = Math.random() * 5 + 1;   // Adjust based on your octree bounds
            randomZ = Math.random() * 30 - 10; // Adjust based on your octree bounds
            // Calculate distance from player start position (0, 0.35, 0)
            dist = Math.sqrt(randomX * randomX + (randomY - 0.35) * (randomY - 0.35) + randomZ * randomZ);
        } while (dist < 4); // Minimum distance of 4 units from player
        enemies.push({
            mesh: enemy,
            collider: new THREE.Sphere(new THREE.Vector3(randomX, randomY, randomZ), ENEMY_RADIUS),
            velocity: new THREE.Vector3(0, Math.random() * 2 + 1, 0), // Random movement
            direction: 1, // 1 for moving up, -1 for moving down
        });
    } 
}
positionEnemies(); // Initial positioning of enemies
// Add Targets
const targetGeometry = new THREE.SphereGeometry(TARGET_RADIUS, 16, 16);
const targetMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green color for targets
// Function to initialize and reset target positions
function positionTargets() {
    for (let i = 0; i < NUM_TARGETS; i++) {
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        target.castShadow = true;
        target.receiveShadow = true;
        scene.add(target);
        let randomX, randomY, randomZ, dist;
        // Place Targets Randomly Within The Octree Bounds
        do {
            randomX = Math.random() * 30 - 10; // Adjust based on your octree bounds
            randomY = Math.random() * 2;  // Adjust based on your octree bounds
            randomZ = Math.random() * 30 - 10; // Adjust based on your octree bounds
            // Calculate distance from player start position (0, 0.35, 0)
            dist = Math.sqrt(randomX * randomX + (randomY - 0.35) * (randomY - 0.35) + randomZ * randomZ);
        } while (dist < 4); // Minimum distance of 4 units from player
        targets.push({
        mesh: target,
        collider: new THREE.Sphere(new THREE.Vector3(randomX, randomY, randomZ), TARGET_RADIUS),
        velocity: new THREE.Vector3(0, Math.random() * 2 + 1, 0), // Random movement
        direction: 1, // 1 for moving up, -1 for moving down
        });
    }
}
positionTargets(); // Initial positioning of targets
// Add NPC With More Complex Behavior
const npcBehavior = {
    jumpFrequency: 2.0, // jumps every 3 seconds
    ballThrowPower: 40, // stronger throws
    ballThrowFrequency: 2.0, // throws every 2.0 seconds
    targetSelectionRadius: 25, // selects targets up to 25 units away
    enemyAvoidanceDistance: 7, // avoids enemies within 7 units
    movementSpeedMultiplier: 2.0 // 20% faster movement
};
//const npc = new NPC({ scene, startPos: new THREE.Vector3(0, 0.35, 0), behavior: npcBehavior });

// Add Lights Using Skybox
new HDRLoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    //scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
let player = new Player();
//console.log("Player created after world load: ", player.direction); //Debug Line
let npc; // Declare npc variable here to ensure it's in scope for the game loop and other functions
// Load Game Model
const loader = new GLTFLoader();
loader.load('./assets/collision-world.glb', ( gltf ) => {
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
        // Create NPC after the world is loaded to ensure it has access to the octree for navigation
        npc = new NPC({ scene, startPos: new THREE.Vector3(5, 0.75, 5) });
        //console.log("NPC initialized after world load"); //Debug Line
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
scoreDisplay.style.fontSize = '36px';
scoreDisplay.style.fontWeight = 'bold';
scoreDisplay.innerText = `Player Score: ${score.counter} NPC Score: ${score.npcCounter}`; // Initial score display
document.body.appendChild(scoreDisplay);
// Update Score Display Function
export function updateScoreDisplay(score) {
    console.log("Score updated:", score.counter); // Debugging line
    console.log("NPC Score updated:", score.npcCounter); // Debugging line
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        console.log("Score element found!"); // Debugging line
        scoreElement.innerText = `Player Score: ${score.counter} NPC Score: ${score.npcCounter}`;
    } else {
        console.error("Score element not found!");
    }
}
//-----END ADD SCORE DISPLAY-----//

//-----ADD TIMER-----//
const timerDisplay = document.createElement('div');
timerDisplay.id = 'timer';
timerDisplay.style.position = 'absolute';
timerDisplay.style.top = '60px';
timerDisplay.style.right = '10px';
timerDisplay.style.color = 'white';
timerDisplay.style.fontSize = '36px';
timerDisplay.style.fontWeight = 'bold';
timerDisplay.innerText = '03:00'; // Initial timer value
document.body.appendChild(timerDisplay);
let timerInterval; // Variable to store the interval ID
let timeRemaining = 180; // 3 minutes in seconds
function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        // Update The Timer Display
        timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        // End The Game If The Timer Reaches Zero
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000); // Update every second
}
//-----END ADD TIMER-----//

//-----ADD MUSIC-----//
// Create an audio element for background music
const backgroundMusic = document.createElement('audio');
backgroundMusic.src = './assets/Gemtracks-Smurf-Speed.mp3'; // Path to your audio file
backgroundMusic.loop = true; // Loop the music
backgroundMusic.volume = 0.15; // Set the volume (0.0 to 1.0)
const muteButton = document.createElement('button');
muteButton.innerText = 'Mute';
muteButton.style.position = 'absolute';
muteButton.style.top = `${stats.dom.offsetHeight + 10}px`; // Position it just below the FPS counter
muteButton.style.left = '10px';
muteButton.style.zIndex = '100';
document.body.appendChild(muteButton);
let isMuted = false;
muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    backgroundMusic.muted = isMuted;
    muteButton.innerText = isMuted ? 'Unmute' : 'Mute';
});
//-----END MUSIC-----//

//-----ADD GAME GUIDE-----//
const guideButton = document.createElement('button');
guideButton.id = 'guide-button';
guideButton.innerText = 'Game Guide';
guideButton.style.position = 'absolute';
guideButton.style.bottom = '10px';
guideButton.style.right = '10px';
guideButton.style.padding = '10px 20px';
guideButton.style.fontSize = '16px';
guideButton.style.cursor = 'pointer';
guideButton.style.border = 'none';
guideButton.style.borderRadius = '5px';
guideButton.style.backgroundColor = '#007bff';
guideButton.style.color = 'white';
guideButton.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
guideButton.style.transition = 'background-color 0.3s';
guideButton.addEventListener('mouseover', () => {
    guideButton.style.backgroundColor = '#0056b3';
});
guideButton.addEventListener('mouseout', () => {
    guideButton.style.backgroundColor = '#007bff';
});
guideButton.addEventListener('click', () => {
    window.open('./assets/Game-User-Guide.pdf', '_blank'); // Opens the PDF in a new tab
});
//-----END GAME GUIDE-----//

//-----START GAME-----//
// Initialize Event Listeners For Controls
eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, player);
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
title.style.fontSize = '64px';
title.style.textAlign = 'center';
startScreen.appendChild(title);
// Add a New Paragraph Between Title and Start Button
const description = document.createElement('div');
description.innerText = 'Prepare yourself for an exciting adventure!\n\nYour mission is to throw snowballs at the GREEN targets while avoiding the RED enemies.\n\nUse your skills to score points and survive!';
description.style.marginBottom = '20px';
description.style.textAlign = 'center';
description.style.fontSize = '32px';
startScreen.appendChild(description);
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
startScreen.appendChild(guideButton); // Add the guide button to the start screen
// Move Game Key Controls Below Start Button
const controlsInfo = document.createElement('div');
controlsInfo.innerText = 'Controls: \nW - Move Forward\nA - Move Left\nS - Move Backward\nD - Move Right\nSpace - Jump\nUse Mouse to Look Around\nLeft Click to Throw Ball from Center of Screen\nHold Left Click to Throw Ball Further';
controlsInfo.style.marginTop = '20px'; // Add spacing above the controls
controlsInfo.style.textAlign = 'center';
controlsInfo.style.fontSize = '18px';
startScreen.appendChild(controlsInfo);
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
    backgroundMusic.play(); // Start the background music
    clock.start(); // Start the clock for timing
    startTimer(); // Start the timer
    animate(); // Start the game loop
});
//-----END START GAME-----//

//-----GAME ANIMATION LOOP-----//
let animationFrameId; // Global variable to store the animation frame ID
function animate() {
    console.log("Animation loop running...");
    animationFrameId = requestAnimationFrame(animate); // Store the frame ID
    animatePoints(points);
    console.log("Snowflakes generated!");
    const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;
    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.
    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
        controls(keyStates, camera, deltaTime, player);
        updatePlayer(deltaTime, worldOctree, GRAVITY, camera, player);
        updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, vector1, vector2, vector3, player);
        updateEnemiesAndTargets(deltaTime, enemies, targets, enemyAndTargetBounds); // Update enemies and targets within the octree
        npc.update(deltaTime, worldOctree, targets, enemies, npcSpawnBall, clock.getElapsedTime(), GRAVITY);
        checkForEnemyCollisions(npc.collider, enemies, camera, player); // Check for collisions between NPC and enemies
        checkBallTargetCollisions(spheres, targets, score, npc, worldOctree); // Check for NPC collisions with targets
        teleportPlayerIfOob(camera, npc.collider, npc, player);
    }
    stats.update();
    renderer.render(scene, camera);
};
//-----END GAME ANIMATION LOOP-----//

//-----GAME OVER-----//
export function endGame() {
    // Stop The Animation Loop
    cancelAnimationFrame(animationFrameId); // Stop the animation loop
    backgroundMusic.pause(); // Stop the background music
    backgroundMusic.currentTime = 0; // Reset the music to the beginning
    // Reset The Clock
    clock.stop();
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
    finalScore.innerText = `Final Score: ${score.counter} | NPC Score: ${score.npcCounter}`;
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
    score.npcCounter = 0;
    updateScoreDisplay(score);
    // Reset the timer
    clearInterval(timerInterval); // Stop the previous timer
    timeRemaining = 180; // Reset to 3 minutes
    timerDisplay.innerText = '03:00'; // Reset the timer display
    
    // Reset Player Position And Velocity
    player.collider.start.set(0, 0.35, 0);
    player.collider.end.set(0, 1, 0);
    player.velocity.set(0, 0, 0);
    player.onFloor = false;
    player.timeSurvived = 0;
    player.jumpFrequency = 0;
    player.turnSpeed = 0;
    
   /* 
    // Reset Player Position And Velocity
    playerCollider.start.set(0, 0.35, 0);
    playerCollider.end.set(0, 1, 0);
    playerVelocity.set(0, 0, 0);*/
    // Reset NPC Position, Velocity, and Behavior State
    npc.collider.start.set(0.6, 0.35, 0.6);
    npc.collider.end.set(0.6, 1, 0.6);
    npc.velocity.set(0, 0, 0);
    //npc.behaviorState = {}; // Reset any custom behavior state variables
    npc.targetIndex = -1; // Reset target index to force new target selection
    npc.lastThrow = 0; // Reset throw timer
    npc.lastJump = 0; // Reset jump timer
    npc.lastBallIndex = 0; // Reset ball index for tracking thrown balls
    npc.onFloor = false; // Reset on-floor state
    npc.baseSpeed = 2.5; // Reset base movement speed
    npc.mesh.position.copy(npc.getCenter()); // Ensure NPC mesh is positioned correctly
    // Reset Spheres
    spheres.forEach(sphere => {
        sphere.mesh.visible = false;
        sphere.collider.center.set(0, -100, 0); // Move spheres out of the scene
        sphere.velocity.set(0, 0, 0);
    });
    // Reset Enemies
    enemies.forEach(enemy => {
        scene.remove(enemy.mesh); // Remove existing enemy meshes from the scene
    });
    enemies.length = 0; // Clear the enemies array
    positionEnemies(); // Reposition enemies using the function to ensure they are placed correctly within the octree bounds
    /*enemies.forEach(enemy => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 5 + 1;
        const randomZ = Math.random() * 30 - 10;
        enemy.collider.center.set(randomX, randomY, randomZ);
        enemy.mesh.position.copy(enemy.collider.center);
        enemy.velocity.set(0, Math.random() * 2 + 1, 0);
        enemy.direction = 1;
    });*/
    // Reset Targets
    targets.forEach(target => {
        scene.remove(target.mesh); // Remove existing target meshes from the scene
    });
    targets.length = 0; // Clear the targets array
    positionTargets(); // Reposition targets using the function to ensure they are placed correctly within the octree bounds    
    /*targets.forEach(target => {
        const randomX = Math.random() * 30 - 10;
        const randomY = Math.random() * 2;
        const randomZ = Math.random() * 30 - 10;
        target.collider.center.set(randomX, randomY, randomZ);
        target.mesh.position.copy(target.collider.center);
        target.velocity.set(0, Math.random() * 2 + 1, 0);
        target.direction = 1;
    });*/
    startScreen.style.display = 'flex'; // Show the start screen again
}