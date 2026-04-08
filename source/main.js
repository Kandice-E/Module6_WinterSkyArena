import * as THREE from 'three';
import { controls, eventListeners, setCurrentPlayerStats } from './controls.js'; 
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
import { Population } from './geneticAlgorithm.js';
// Checking Changes
//-----GLOBAL VARIABLES FOR IMPORT FUNCTIONS-----//
const keyStates = {}; // Object to store key states
let mouseTime = 0;
const STEPS_PER_FRAME = 3;
let isFirstFrameOfRound = false; // Flag to handle first frame
let lastFrameTime = 0; // Track time using performance.now() for reliable deltaTime
let frameCount = 0; // Counter for fps monitoring
let deltaTimeSum = 0; // Sum of deltaTime values for averaging
const TARGET_FPS = 120; // Cap framerate at 120fps
const TARGET_FRAME_TIME = 1000 / TARGET_FPS; // ms per frame (~8.33ms for 120fps)
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
//const playerCollider = new Capsule( new THREE.Vector3( 0, 0.35, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.35 );
const worldOctree = new Octree(); // Create a new Octree for the world
const vector1 = new THREE.Vector3(); // Vector for collision detection
const vector2 = new THREE.Vector3(); // Vector for collision detection
const vector3 = new THREE.Vector3(); // Vector for collision detection
// New Globals for Rounds and Metrics Collection
let generationsCompleted = 0;
const MAX_GENERATIONS = 1;
let numGenomesTested = 0;
let currentRound = 1;
const MAX_ROUNDS = 3;
const GENOMES_PER_ROUND = 2;
let genomeSlotInRound = 0;
let roundsComplete = 0;
const MAX_ROUND_TIME = 75;
const genomeTestWindow = 30;
let roundRunning = false;
let roundTransitioning = false; // Flag to prevent continueRound from being called multiple times
let roundMetrics = [];
let playerStats = {
    startTime: 0,
    timeSurvived: 0,
    jumpCount: 0,
    turnAmount: 0,
    score: 0,
    // Behavior tracking for player (same as NPC for comparison)
    ballsThrown: 0,
    targetsHit: 0,
    safeFrames: 0,
    totalFrames: 0,
    actionLatencies: [],
    closestEnemyDistance: Infinity,
    averageEnemyDistance: 0,
    targetApproachDistance: 0,
    timeSpentAvoidingEnemies: 0
};
let npcStats = {
    startTime: 0,
    timeSurvived: 0,
    targetsHit: 0,
    safeFrames: 0,
    totalFrames: 0,
    actionLatencies: [],
    jumpCount: 0,
    turnAmount: 0,
    score: 0
};
let generationalPopulation = new Population(6);
let currentGenomeIndex = 0;
let allGenerationsCSVData = []; // Accumulate CSV data across all generations
export const collisionState = {
    lastPlayerEnemyCollisionTime: 0
};
export const COLLISION_COOLDOWN = 0.5;
//-----END GLOBAL VARIABLES-----//

//-----SETUP-----//
let timer = new THREE.Timer();
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
//ADD A NEW REPOSITION TARGETS AND ENEMIES FUNCTION
//TO REUSE THE TARGETS AND ENEMIES INSTEAD OF RECREATING
//THEM WHENEVER POSITION TARGETS/ENEMIES IS CALLED
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
scoreDisplay.innerText = `Player Score: ${score.counter} NPC Score: ${score.npcCounter}`; // Initial score display
document.body.appendChild(scoreDisplay);
const roundDisplay = document.createElement('div');
roundDisplay.id = 'round-display';
roundDisplay.innerText = `Round: ${currentRound}`;
document.body.appendChild(roundDisplay);
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
timerDisplay.innerText = '01:15'; // Initial timer value
document.body.appendChild(timerDisplay);
let roundStartTime;
let timerInterval; // Variable to store the interval ID
//let timeRemaining = MAX_ROUND_TIME; // 1.25 minutes in seconds
function startTimer() {
    roundStartTime = performance.now();
    timerInterval = setInterval(() => {
        const timeElapsed = (performance.now() - roundStartTime) / 1000;
        const timeRemaining = Math.max(0, MAX_ROUND_TIME - timeElapsed);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        // Update The Timer Display
        timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        // Safety timeout: if timer reaches 0, force end the round if still running
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            if (roundRunning) {
                continueRound();
            }
        }
    }, 100); // Update more frequently for accuracy
}
//-----END ADD TIMER-----//

//-----CREATE ROUND COUNTDOWN-----//
const roundCountdown = document.createElement('div');
roundCountdown.id = 'round-countdown';
//document.body.appendChild(roundCountdown);
function showRoundCountdown(seconds, onFinish) {
    if (!roundCountdown.parentElement) {
        document.body.appendChild(roundCountdown);
    }
    roundCountdown.style.display = 'flex';
    let value = seconds;
    roundCountdown.textContent = `Round ${currentRound} in ${value}`;
    const timerId = setInterval(() => {
        value -= 1;
        if (value > 0) {
            roundCountdown.textContent = `Round ${currentRound} in ${value}`;
        } else {
            clearInterval(timerId);
            roundCountdown.style.display = 'none';
            onFinish();
        }
    }, 1000);
}
//-----END CREATE ROUND COUNTDOWN-----//

//-----ADD MUSIC-----//
// Create an audio element for background music
const backgroundMusic = document.createElement('audio');
backgroundMusic.src = './assets/Gemtracks-Smurf-Speed.mp3'; // Path to your audio file
backgroundMusic.loop = true; // Loop the music
backgroundMusic.volume = 0.15; // Set the volume (0.0 to 1.0)
const muteButton = document.createElement('button');
muteButton.id = 'mute-button';
muteButton.innerText = 'Mute';
//console.log("Amount to offset mute button: >>>>>>>", stats.dom.offsetHeight + 10);// Position it just below the FPS counter
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
//-----ADD RESET GAME BUTTON-----//
    const restartButton = document.createElement('button');
    restartButton.id = 'restart-button';
    restartButton.innerText = 'Restart Game';
    document.body.appendChild(restartButton);
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
        }
        roundRunning = false; // Signal animate loop to stop
        cancelAnimationFrame(animationFrameId); // Cancel pending animation frame
        restartGame(); // Always call restartGame directly
    });
//-----END RESET GAME BUTTON-----//
//-----START GAME-----//
// Initialize Event Listeners For Controls
eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, player, playerStats);
// Create The Start Screen Overlay
const startScreen = document.createElement('div');
startScreen.id = 'start-screen';
// Add A Title
const title = document.createElement('div');
title.id = 'title';
title.innerText = 'Welcome to Winter Sky Arena!';
startScreen.appendChild(title);
// Add a New Paragraph Between Title and Start Button
const description = document.createElement('div');
description.id = 'game-description';
description.innerText = 'Prepare yourself for an exciting adventure!\n\nYour mission is to throw snowballs at the GREEN targets while avoiding the RED enemies.\n\nUse your skills to score points and survive!';
startScreen.appendChild(description);
// Add A Start Button
const startButton = document.createElement('button');
startButton.id = 'start-button';
startButton.innerText = 'Start Game';
startScreen.appendChild(startButton);
startScreen.appendChild(guideButton); // Add the guide button to the start screen
//startScreen.appendChild(restartButton);
// Move Game Key Controls Below Start Button
const controlsInfo = document.createElement('div');
controlsInfo.id = 'controls-info';
controlsInfo.innerText = 'Controls: \nW - Move Forward\nA - Move Left\nS - Move Backward\nD - Move Right\nSpace - Jump\nUse Mouse to Look Around\nLeft Click to Throw Ball from Center of Screen\nHold Left Click to Throw Ball Further';
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
    roundRunning = true;
    resetMetricsForNextGenome(); // Initialize metrics with proper startTime for first round
    player.score = 0; // Reset player score
    npc.score = 0; // Reset NPC score
    startRound();
});
//-----END START GAME-----//

// New function for round state logic: start, end, reset
function startRound(showCountdown = true) {
    roundTransitioning = false; // Reset transition flag
    genomeSlotInRound += 1;
    const genome = generationalPopulation.genomes[currentGenomeIndex];
    npc.behavior = genome.behavior;
    console.log("CURRENT NPC BEHAVIOR GENOME BEING TESTED: ", genome.behavior);
    
    // Reset NPC frame tracking for this test to prevent accumulation across rounds
    npc.totalFrames = 0;
    npc.actionLatencies.length = 0;
    npc.framesSinceTargetDetection = 0;
    
    // CRITICAL: Create a fresh timer to prevent accumulated time from multiple rounds
    // This prevents 2000+ fps after multiple rounds
    timer = new THREE.Timer();
    // Call getDelta() once to prime the timer so getElapsed() starts working
    timer.getDelta();
    lastFrameTime = performance.now(); // Reset frame time tracking for deltaTime calculation
    roundStartTime = performance.now(); // Track round start for NPC time tracking
    frameCount = 0; // Reset frame counter
    deltaTimeSum = 0; // Reset deltaTime sum
    isFirstFrameOfRound = true; // Mark that the next frame will be the first frame
    console.log("startRound: Created fresh timer, reset counters, set isFirstFrameOfRound to true");
    
    timerDisplay.innerText = '01:15'; // Reset timer display at the start of each round
    //Update round display
    roundDisplay.innerText = `Round: ${currentRound}/${MAX_ROUNDS}`;
    console.log(`Player Score: ${score.counter} NPC Score: ${score.npcCounter}`); // Debugging line
    console.log(`Player Score from Player Stats: ${playerStats.score} NPC Score from NPC Stats: ${npcStats.score}`); // Debugging line
    
    if (showCountdown) {
        // Show countdown only for new rounds
        showRoundCountdown(3, () => {
        roundRunning = true;
        // Resume background music if it's not already playing (for new generations)
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        }
        startTimer(); // Start the timer
        playerStats.startTime = performance.now(); // Initialize player stats timing
        npcStats.startTime = performance.now();
        animate();
        });
    } else {
        // Skip countdown for genome transitions within the same round
        roundRunning = true;
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        }
        startTimer();
        playerStats.startTime = performance.now();
        npcStats.startTime = performance.now();
        animate();
    }
}
export function startNextRound() {
    currentRound += 1;
    roundsComplete += 1;
    //updateMetrics();
    resetMetricsForNextGenome();
    player.score = 0; // Reset player score for next round
    npc.score = 0; // Reset NPC score for next round
    genomeSlotInRound = 0;
    currentGenomeIndex += 1;
    resetRound();
    const currentGenome = generationalPopulation.genomes[currentGenomeIndex];
    npc.behavior = currentGenome.behavior;
    console.log("STARTING NEXT ROUND AFTER 2 GENOME TESTS:>>>>>>>>>");
    startRound();
    //showRoundCountdown(3, () => {
        //startRound();
    //});
}
function updateMetrics() {
    const genomeId = generationalPopulation.genomes[currentGenomeIndex].id;
    const genome = generationalPopulation.genomes[currentGenomeIndex];
    
    // Ensure timeSurvived is valid for division
    const playerTimeSurvived = Math.max(playerStats.timeSurvived, 0.001); // Minimum 1ms to avoid divide-by-zero
    const npcTimeSurvived = Math.max((performance.now() - npcStats.startTime) / 1000, 0.001);
    const playerTotalFrames = Math.max(playerStats.totalFrames, 1);
    const npcTotalFrames = Math.max(npcStats.totalFrames, 1);
    
    console.log(`[END ROUND ${currentRound}] Player: ${playerStats.ballsThrown} throws, ${playerStats.jumpCount} jumps | NPC: ${npcStats.ballsThrown} throws, ${npcStats.jumpCount} jumps`);
    
    // Calculate derived player behavior metrics
    const playerThrowFrequency = playerStats.ballsThrown > 0 ? playerTimeSurvived / playerStats.ballsThrown : 0;
    const playerAvoidanceRatio = playerStats.safeFrames / playerTotalFrames;
    const playerAvgActionLatency = playerStats.actionLatencies.length > 0 
        ? playerStats.actionLatencies.reduce((a,b)=>a+b) / playerStats.actionLatencies.length 
        : 0;
    
    // Calculate derived NPC behavior metrics
    const npcThrowFrequency = npcStats.ballsThrown > 0 ? npcTimeSurvived / npcStats.ballsThrown : 0;
    const npcAvoidanceRatio = npcStats.safeFrames / npcTotalFrames;
    const npcAvgActionLatency = npcStats.actionLatencies.length > 0
        ? npcStats.actionLatencies.reduce((a,b)=>a+b) / npcStats.actionLatencies.length
        : 0;
    
    roundMetrics.push({
        round: currentRound,
        genomeIndex: currentGenomeIndex,
        player: {
            timeSurvived: playerStats.timeSurvived,
            jumpFrequency: playerStats.jumpCount / playerTimeSurvived,
            measuredjumpFrequency: playerStats.jumpCount > 0 ? playerTimeSurvived / playerStats.jumpCount : 0,
            turnSpeed: playerStats.turnAmount / playerTimeSurvived,
            score: playerStats.score,
            ballsThrown: playerStats.ballsThrown,
            targetsHit: playerStats.targetsHit,
            throwFrequency: playerThrowFrequency,
            safeFrames: playerStats.safeFrames,
            totalFrames: playerTotalFrames,
            avoidanceRatio: playerAvoidanceRatio,
            closestEnemyDistance: playerStats.closestEnemyDistance,
            averageEnemyDistance: playerStats.averageEnemyDistance,
            avgActionLatency: playerAvgActionLatency,
            timeAvoidingEnemies: playerStats.timeSpentAvoidingEnemies
        },
        npc: {
            timeSurvived: npcTimeSurvived,
            targetsHit: npcStats.targetsHit,
            framesSafeDistance: npcStats.safeFrames,
            totalFrames: npcTotalFrames,
            ballsThrown: npcStats.ballsThrown,
            throwFrequency: npcThrowFrequency,
            avgActionLatency: npcAvgActionLatency,
            measuredJumpFrequency: npcStats.jumpCount / npcTimeSurvived,
            turnSpeed: npcStats.turnAmount / npcTimeSurvived,
            score: npcStats.score,
            avoidanceRatio: npcAvoidanceRatio
        },
        genomeId: genomeId,
        behavior: {
            jumpFrequency: genome.behavior.jumpFrequency,
            ballThrowPower: genome.behavior.ballThrowPower,
            ballThrowFrequency: genome.behavior.ballThrowFrequency,
            targetSelectionRadius: genome.behavior.targetSelectionRadius,
            enemyAvoidanceDistance: genome.behavior.enemyAvoidanceDistance,
            movementSpeedMultiplier: genome.behavior.movementSpeedMultiplier
        },
        // Behavior comparison: how NPC compares to player
        behaviorComparison: {
            npcVsPlayerJumpRatio: (npcStats.jumpCount / npcTimeSurvived) / (playerStats.jumpCount / playerTimeSurvived),
            npcVsPlayerThrowRatio: playerStats.ballsThrown > 0 ? (npcStats.ballsThrown / npcTimeSurvived) / (playerStats.ballsThrown / playerTimeSurvived) : 0,
            npcVsPlayerAvoidanceRatio: playerAvoidanceRatio > 0 ? npcAvoidanceRatio / playerAvoidanceRatio : 0,
            npcVsPlayerTurnRatio: (npcStats.turnAmount / npcTimeSurvived) / (playerStats.turnAmount / playerTimeSurvived),
            scoreRatio: playerStats.score > 0 ? npcStats.score / playerStats.score : 0
        }
    });
    console.log(`[ROUND ${currentRound} SAVED] Player throws: ${playerStats.ballsThrown}, NPC throws: ${npcStats.ballsThrown}`);
}
function resetRound() {
    resetNpcPosition();
    player.collider.start.set(0,0.35,0);
    player.collider.end.set(0,1,0);
    player.velocity.set(0,0,0);
    player.jumpCount = 0; // Reset player jump counter
    score.counter = 0;
    score.npcCounter = 0;
    updateScoreDisplay(score);
    repositionEnemies();
    repositionTargets();
}
// Reposition existing enemies without creating new ones
function repositionEnemies() {
    for (let i = 0; i < enemies.length; i++) {
        let randomX, randomY, randomZ, dist;
        do {
            randomX = Math.random() * 30 - 10;
            randomY = Math.random() * 5 + 1;
            randomZ = Math.random() * 30 - 10;
            dist = Math.sqrt(randomX * randomX + (randomY - 0.35) * (randomY - 0.35) + randomZ * randomZ);
        } while (dist < 4);
        enemies[i].collider.center.set(randomX, randomY, randomZ);
        enemies[i].mesh.position.set(randomX, randomY, randomZ);
        enemies[i].velocity.set(0, Math.random() * 2 + 1, 0);
        enemies[i].direction = 1;
    }
}
// Reposition existing targets without creating new ones
function repositionTargets() {
    for (let i = 0; i < targets.length; i++) {
        let randomX, randomY, randomZ, dist;
        do {
            randomX = Math.random() * 30 - 10;
            randomY = Math.random() * 2;
            randomZ = Math.random() * 30 - 10;
            dist = Math.sqrt(randomX * randomX + (randomY - 0.35) * (randomY - 0.35) + randomZ * randomZ);
        } while (dist < 4);
        targets[i].collider.center.set(randomX, randomY, randomZ);
        targets[i].mesh.position.set(randomX, randomY, randomZ);
        targets[i].velocity.set(0, Math.random() * 2 + 1, 0);
        targets[i].direction = 1;
    }
}
function resetNpcPosition() {
    npc.collider.start.set(0.6,0.35,0.6);
    npc.collider.end.set(0.6,1,0.6);
    npc.velocity.set(0,0,0);
    npc.framesSinceTargetDetection = 0;
    npc.lastActionLatency = 0;
    npc.actionLatencies.length = 0;
    npc.targetsHit = 0; // Reset targets hit counter
    npc.jumpCount = 0; // Reset jump counter
    npc.turnAmount = 0; // Reset turn amount
    npc.ballsThrown = 0; // Reset balls thrown counter
    npc.lastJump = 0; // Reset jump timing to allow immediate jump
    npc.lastThrow = 0; // Reset throw timing to allow immediate throw
    npc.targetIndex = -1; // Reset target selection
    npc.lastTargetIndex = 0;
}

function resetMetricsForNextGenome() {
    console.log(">>> RESETTING METRICS FOR NEXT GENOME. Old playerStats.totalFrames was:", playerStats.totalFrames, "Old npcStats.totalFrames was:", npcStats.totalFrames);
    playerStats = {
        startTime: performance.now(),
        timeSurvived: 0,
        jumpCount: 0,
        turnAmount: 0,
        score: 0,
        ballsThrown: 0,
        targetsHit: 0,
        safeFrames: 0,
        totalFrames: 0,
        actionLatencies: [],
        closestEnemyDistance: Infinity,
        averageEnemyDistance: 0,
        targetApproachDistance: 0,
        timeSpentAvoidingEnemies: 0
    };
    // Update the module-level reference in controls.js so event listeners use new playerStats
    setCurrentPlayerStats(playerStats);
    npcStats = {
        startTime: performance.now(),
        timeSurvived: 0,
        targetsHit: 0,
        safeFrames: 0,
        totalFrames: 0,
        ballsThrown: 0,
        actionLatencies: [],
        jumpCount: 0,
        turnAmount: 0,
        score: 0
    };
    console.log(">>> New playerStats.totalFrames is:", playerStats.totalFrames, "New npcStats.totalFrames is:", npcStats.totalFrames);
}
// Function to export metrics to CSV
function exportMetricsToCSV() {
    // CSV Header (only add once at the beginning)
    const headers = [
        'Generation',
        'Round',
        'GenomeIndex',
        'GenomeID',
        // Player behavior metrics
        'PlayerTimeSurvived',
        'PlayerJumpFrequency',
        'PlayerMeasuredJumpFrequency',
        'PlayerTurnSpeed',
        'PlayerScore',
        'PlayerBallsThrown',
        'PlayerTargetsHit',
        'PlayerThrowFrequency',
        'PlayerSafeFrames',
        'PlayerTotalFrames',
        'PlayerAvoidanceRatio',
        'PlayerClosestEnemyDist',
        'PlayerAvgEnemyDist',
        'PlayerAvgActionLatency',
        'PlayerTimeAvoidingEnemies',
        // NPC behavior metrics
        'NPCTimeSurvived',
        'NPCTargetsHit',
        'NPCFramesSafeDistance',
        'NPCTotalFrames',
        'NPCBallsThrown',
        'NPCThrowFrequency',
        'NPCAvgActionLatency',
        'NPCJumpFrequency',
        'NPCTurnSpeed',
        'NPCScore',
        'NPCAvoidanceRatio',
        'GenomeFitness',
        // Behavior genes
        'BehaviorJumpFrequency',
        'BehaviorBallThrowPower',
        'BehaviorBallThrowFrequency',
        'BehaviorTargetSelectionRadius',
        'BehaviorEnemyAvoidanceDistance',
        'BehaviorMovementSpeedMultiplier',
        // Behavior comparisons
        'NPCvsPlayerJumpRatio',
        'NPCvsPlayerThrowRatio',
        'NPCvsPlayerAvoidanceRatio',
        'NPCvsPlayerTurnRatio',
        'NPCvsPlayerScoreRatio'
    ];
    
    // CSV Rows for current generation
    const rows = roundMetrics.map(metric => {
        const genome = generationalPopulation.genomes[metric.genomeIndex];
        return [
            generationsCompleted,
            metric.round,
            metric.genomeIndex,
            metric.genomeId,
            // Player metrics
            metric.player.timeSurvived.toFixed(2),
            metric.player.jumpFrequency.toFixed(2),
            metric.player.measuredjumpFrequency.toFixed(2),
            metric.player.turnSpeed.toFixed(2),
            metric.player.score,
            metric.player.ballsThrown,
            metric.player.targetsHit,
            metric.player.throwFrequency.toFixed(2),
            metric.player.safeFrames,
            metric.player.totalFrames,
            metric.player.avoidanceRatio.toFixed(4),
            metric.player.closestEnemyDistance.toFixed(2),
            metric.player.averageEnemyDistance.toFixed(2),
            metric.player.avgActionLatency.toFixed(4),
            metric.player.timeAvoidingEnemies.toFixed(2),
            // NPC metrics
            metric.npc.timeSurvived.toFixed(2),
            metric.npc.targetsHit,
            metric.npc.framesSafeDistance,
            metric.npc.totalFrames,
            metric.npc.ballsThrown,
            metric.npc.throwFrequency.toFixed(2),
            metric.npc.avgActionLatency.toFixed(4),
            metric.npc.measuredJumpFrequency.toFixed(2),
            metric.npc.turnSpeed.toFixed(2),
            metric.npc.score,
            metric.npc.avoidanceRatio.toFixed(4),
            genome.fitness.toFixed(4),
            // Behavior genes
            metric.behavior.jumpFrequency,
            metric.behavior.ballThrowPower,
            metric.behavior.ballThrowFrequency,
            metric.behavior.targetSelectionRadius,
            metric.behavior.enemyAvoidanceDistance,
            metric.behavior.movementSpeedMultiplier,
            // Behavior comparisons
            metric.behaviorComparison.npcVsPlayerJumpRatio.toFixed(4),
            metric.behaviorComparison.npcVsPlayerThrowRatio.toFixed(4),
            metric.behaviorComparison.npcVsPlayerAvoidanceRatio.toFixed(4),
            metric.behaviorComparison.npcVsPlayerTurnRatio.toFixed(4),
            metric.behaviorComparison.scoreRatio.toFixed(4)
        ];
    });
    
    // Accumulate data
    allGenerationsCSVData.push({
        headers: headers,
        rows: rows
    });
    
    console.log(`Generation ${generationsCompleted} metrics added to export queue`);
}

// Function to download all accumulated CSV data
function downloadAllGenerationsCSV() {
    if (allGenerationsCSVData.length === 0) {
        console.log('No metrics to export');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `all_generations_metrics_${timestamp}.csv`;
    
    // Build combined CSV content
    let csvContent = allGenerationsCSVData[0].headers.join(',') + '\n';
    
    // Append all rows from all generations
    allGenerationsCSVData.forEach(generationData => {
        generationData.rows.forEach(row => {
            csvContent += row.map(cell => {
                const str = String(cell);
                return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(',') + '\n';
        });
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    console.log(`All metrics exported to ${filename}`);
}

// Function to complete one generation once three rounds are played
function completeGeneration() {
    numGenomesTested += 6;
    console.log("=== COMPLETING GENERATION ===");
    console.log("roundMetrics length:", roundMetrics.length);
    if (roundMetrics.length > 0) {
        console.log("First metric sample:", roundMetrics[0]);
    }
    generationalPopulation.evaluateFitness(roundMetrics);
    generationsCompleted += 1;
  if (generationsCompleted < MAX_GENERATIONS) {
    exportMetricsToCSV();
    // Find the best genome and protect it (elitism)
    const bestGenomeIndex = generationalPopulation.findBestGenomeIndex();
    console.log("Best genome index:", bestGenomeIndex, "with fitness:", generationalPopulation.genomes[bestGenomeIndex].fitness);
    
    console.log("=== BEFORE EVOLUTION Gen", generationsCompleted, "===");
    generationalPopulation.genomes.forEach((g, i) => {
        console.log(`Genome ${i}:`, {id: g.id, jumpFreq: g.behavior.jumpFrequency, ballPower: g.behavior.ballThrowPower, fitness: g.fitness});
    });
    
    // Evolve population: keep best genome, replace bottom 5 with evolved children
    const worstIndices = generationalPopulation.getIndicesOfWorstGenomes(bestGenomeIndex, 5);
    console.log("Worst genome indices to replace:", worstIndices);
    
    worstIndices.forEach((worstIndex, iteration) => {
      console.log(`Evolving child ${iteration+1} of 5... replacing genome at index ${worstIndex}`);
      
      // Tournament selection: pick 2 parents from the population
      const parent1Obj = generationalPopulation.tournamentSelection();
      const parent2Obj = generationalPopulation.tournamentSelection();
      
      // Extract the genome objects (tournamentSelection returns {genome, index, fitness})
      const parent1 = parent1Obj.genome;
      const parent2 = parent2Obj.genome;
      
      // Crossover
      const child = generationalPopulation.crossover(parent1, parent2);
      
      // Mutation
      generationalPopulation.mutate(child);
      
      // Replace worst genome with evolved child
      generationalPopulation.genomes[worstIndex] = child;
      console.log(`Replaced genome at index ${worstIndex} with new child (id: ${child.id})`);
    });
    
    console.log("=== AFTER EVOLUTION Gen", generationsCompleted + 1, "===");
    generationalPopulation.genomes.forEach((g, i) => {
        console.log(`Genome ${i}:`, {id: g.id, jumpFreq: g.behavior.jumpFrequency, ballPower: g.behavior.ballThrowPower, fitness: g.fitness});
    });
    
    currentGenomeIndex = 0;
    currentRound = 1;
    genomeSlotInRound = 0;
    roundMetrics = [];
    resetMetricsForNextGenome();
    resetRound();
    startRound();
  } else {
    exportMetricsToCSV();
    downloadAllGenerationsCSV();
    console.log("Current Population Genome Fitness Values: ", generationalPopulation.fitnessScores);
    endGame();
  }
}
function collectLiveMetrics(deltaTime) {
    // Increment Player Stats from Player object
    playerStats.timeSurvived = (performance.now() - playerStats.startTime) / 1000;
    playerStats.jumpCount = player.jumpCount; // Capture current jump count (not accumulate)
    playerStats.turnAmount += Math.abs(camera.rotation.y - lastCameraY);
    playerStats.score = player.score; // Current score at this moment
    playerStats.totalFrames += 1; // Track frames for player like NPC
    lastCameraY = camera.rotation.y;
    
    // Calculate player distance from enemies (for avoidance behavior comparison)
    let totalEnemyDistance = 0;
    let closestDistance = Infinity;
    for (let enemy of enemies) {
        const distance = player.collider.start.distanceTo(enemy.mesh.position);
        totalEnemyDistance += distance;
        closestDistance = Math.min(closestDistance, distance);
    }
    playerStats.closestEnemyDistance = closestDistance;
    playerStats.averageEnemyDistance = enemies.length > 0 ? totalEnemyDistance / enemies.length : 0;
    
    // Track when player is safe from enemies (for comparison with NPC avoidance)
    const PLAYER_SAFE_DISTANCE = 10; // Units away from nearest enemy
    if (closestDistance >= PLAYER_SAFE_DISTANCE) {
        playerStats.safeFrames += 1;
    } else {
        playerStats.timeSpentAvoidingEnemies += deltaTime;
    }
    
    // Increment NPC Stats from NPC object
    npcStats.timeSurvived = (performance.now() - npcStats.startTime) / 1000;
    npcStats.targetsHit = npc.targetsHit; // Capture current targets hit count
    npcStats.totalFrames += 1;
    // Only increment safe frames when NPC is actually safe from all enemies
    if (npc.isNpcFarFromAllEnemies(enemies)) {
        npcStats.safeFrames += 1;
    }
    // Use actionLatencies from NPC object (don't overwrite)
    npcStats.score = npc.score; // Current score at this moment
    if (npc.lastActionLatency != null) {
        npcStats.actionLatencies.push(npc.lastActionLatency);
        npc.lastActionLatency = null;
    }
    npcStats.ballsThrown = npc.ballsThrown; // Capture ball throw counter
    npcStats.jumpCount = npc.jumpCount; // Capture current jump count
    npcStats.turnAmount = npc.turnAmount; // Capture current turn amount
    
    // Check for npc testing window limit reached
    //console.log("----------COLLECTING LIVE METRICS----------: ", npcStats.timeSurvived);
    if (npcStats.timeSurvived >= genomeTestWindow && !roundTransitioning) {
        roundTransitioning = true;
        continueRound();
    }
}
export function continueRound() {
    updateMetrics();
    
    // Do NOT stop the animation loop yet - let it continue to finish this frame
    // Only cancel timer to prevent double-firing
    clearInterval(timerInterval);
    
    if (genomeSlotInRound < GENOMES_PER_ROUND) {
            // Testing second genome in same round - skip countdown
            genomeSlotInRound += 1;
            currentGenomeIndex += 1;
            resetMetricsForNextGenome();
            player.score = 0; // Reset player score for next genome test
            npc.score = 0; // Reset NPC score for next genome test
            resetNpcPosition();
            console.log("Previous Genome: ", npc.behavior);
            const currentGenome = generationalPopulation.genomes[currentGenomeIndex];
            npc.behavior = currentGenome.behavior;
            console.log("Current Genome After Updating to Second Test Genome: ", npc.behavior);
            startRound(false); // false = don't show countdown for genome transition
        } else if (currentRound < MAX_ROUNDS) {
            startNextRound();
        } else {
            completeGeneration();
        }
}
//-----GAME ANIMATION LOOP-----//
let animationFrameId; // Global variable to store the animation frame ID
let lastCameraY = 0;
function animate() {
    // Check if we should stop the animation loop
    if(!roundRunning) {
        cancelAnimationFrame(animationFrameId);
        // Queue restart after current frame completes
        if (!document.getElementById('game-over-screen')) {
            setTimeout(() => restartGame(), 50);
        }
        return;
    }
    
    // Always request next frame for smooth display
    animationFrameId = requestAnimationFrame(animate);
    
    // Calculate actual elapsed time since last update
    const currentFrameTime = performance.now();
    const elapsedSinceLastUpdate = currentFrameTime - lastFrameTime;
    
    // Skip physics update if not enough time has passed (60fps throttle = ~16.67ms min per frame)
    if (elapsedSinceLastUpdate < TARGET_FRAME_TIME && !isFirstFrameOfRound) {
        return; // Skip this frame, will render on next RAF callback
    }
    
    console.log("Animation loop running...");
    animatePoints(points);
    
    // Calculate deltaTime for physics update
    let rawDelta = elapsedSinceLastUpdate / 1000; // Convert ms to seconds
    lastFrameTime = currentFrameTime;
    
    console.log(`Frame time delta: ${rawDelta.toFixed(4)}s (throttled to ${TARGET_FPS}fps)`);
    
    // Handle first frame (may have unusual timing due to UI countdown)
    if (isFirstFrameOfRound) {
        console.log("First frame detected, using default deltaTime");
        rawDelta = TARGET_FRAME_TIME / 1000; // Use target frame time for first frame
        isFirstFrameOfRound = false;
    }
    
    let deltaTime = Math.min( 0.05, rawDelta ) / STEPS_PER_FRAME;
    console.log(`Calculated deltaTime for this frame: ${deltaTime.toFixed(4)} seconds`);//Debugging line to check final delta time used in updates
    //////////DEBUG LINES REMOVE AFTER TESTING
    // Track fps data
    frameCount++;
    deltaTimeSum += rawDelta;
    if (frameCount % 60 === 0) {
        const avgDeltaTime = deltaTimeSum / 60;
        const fps = 1 / avgDeltaTime;
        console.log(`[ROUND ${currentRound} FRAME ${frameCount}] Avg FPS: ${fps.toFixed(0)}, Avg DeltaTime: ${avgDeltaTime.toFixed(4)}s`);
        deltaTimeSum = 0;
    }////////DEBUG LINES REMOVE AFTER TESTING
    
    // Collect Live Metrics
    collectLiveMetrics(deltaTime);
    
    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.
    const elapsedTimeInRound = (performance.now() - roundStartTime) / 1000; // Seconds elapsed since round started
    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
        controls(keyStates, camera, deltaTime, player);
        updatePlayer(deltaTime, worldOctree, GRAVITY, camera, player);
        updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, vector1, vector2, vector3, player);
        updateEnemiesAndTargets(deltaTime, enemies, targets, enemyAndTargetBounds);
        npc.update(deltaTime, worldOctree, targets, enemies, npcSpawnBall, elapsedTimeInRound, GRAVITY);
        checkForEnemyCollisions(npc.collider, enemies, camera, player, score, npc);
        checkBallTargetCollisions(spheres, targets, score, npc, worldOctree, player, playerStats);
        teleportPlayerIfOob(camera, npc.collider, npc, player);
    }
    stats.update();
    renderer.render(scene, camera);
};
//-----END GAME ANIMATION LOOP-----//

//-----ROUND LOST-----//


//-----END ROUND LOST-----//
//-----GAME OVER-----//
export function endGame() {
    // Stop The Animation Loop
    cancelAnimationFrame(animationFrameId); // Stop the animation loop
    backgroundMusic.pause(); // Stop the background music
    backgroundMusic.currentTime = 0; // Reset the music to the beginning
    roundRunning = false;
    // Stop/Reset the Timer
    clearInterval(timerInterval);
    // Hide the start screen and round countdown
    startScreen.style.display = 'none';
    roundCountdown.style.display = 'none';
    // Create A Game-Over Overlay
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'game-over-screen';
    // Add A "Game Over" Message
    const gameOverMessage = document.createElement('div');
    gameOverMessage.id = 'game-over-message';
    gameOverMessage.innerText = 'Game Over!';
    gameOverScreen.appendChild(gameOverMessage);
    // Display The Final Score
    const finalScore = document.createElement('div');
    finalScore.id = 'final-score';
    finalScore.innerText = `Final Score: ${score.counter} | NPC Score: ${score.npcCounter}`;
    gameOverScreen.appendChild(finalScore);
    // Append The Game-Over Screen To The Document Body
    document.body.appendChild(gameOverScreen);
}
//-----RESTART GAME-----//
function restartGame() {
    // Stop The Animation Loop
    cancelAnimationFrame(animationFrameId); // Stop the animation loop
    backgroundMusic.pause(); // Stop the background music
    backgroundMusic.currentTime = 0; // Reset the music to the beginning
    roundRunning = false; // Reset roundRunning to false
    console.log("Restarting game..."); // Debugging line
    
    // Reset metrics and generation tracking
    allGenerationsCSVData = [];
    generationsCompleted = 0;
    currentRound = 1;
    genomeSlotInRound = 0;
    currentGenomeIndex = 0;
    roundMetrics = [];
    roundTransitioning = false;
    generationalPopulation = new Population(6);
    
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
    timerDisplay.innerText = '01:15'; // Reset the timer display
    
    // Reset Player Position And Velocity
    player.collider.start.set(0, 0.35, 0);
    player.collider.end.set(0, 1, 0);
    player.velocity.set(0, 0, 0);
    player.onFloor = false;
    player.timeSurvived = 0;
    player.jumpFrequency = 0;
    player.turnSpeed = 0;
    
    // Reset NPC Position, Velocity, and Behavior State
    npc.collider.start.set(0.6, 0.35, 0.6);
    npc.collider.end.set(0.6, 1, 0.6);
    npc.velocity.set(0, 0, 0);
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
    
    // Reset Targets
    targets.forEach(target => {
        scene.remove(target.mesh); // Remove existing target meshes from the scene
    });
    targets.length = 0; // Clear the targets array
    positionTargets(); // Reposition targets using the function to ensure they are placed correctly within the octree bounds    
    
    startScreen.style.display = 'flex'; // Show the start screen again
}