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
let score = {counter: 0, npcCounter1: 0, npcCounter2: 0, npcCounter3: 0}; // Initialize score counters
const worldOctree = new Octree(); // Create a new Octree for the world
const vector1 = new THREE.Vector3(); // Vector for collision detection
const vector2 = new THREE.Vector3(); // Vector for collision detection
const vector3 = new THREE.Vector3(); // Vector for collision detection
// New Globals for Rounds and Metrics Collection //
export let generationsCompleted = 0;
const MAX_GENERATIONS = 10; // Limit total generations to prevent infinite testing
let currentRound = 1;
const MAX_ROUND_TIME = 75; // 75 seconds max per round to prevent infinite loops
const MAX_ROUNDS = 1; // 1 round per generation: all 6 genomes tested via 3 NPCs in parallel
const NUM_NPCS = 3; // 3 NPCs running in parallel
const GENOMES_PER_NPC = 2; // Each NPC tests 2 genomes
let genomeSlotInRound = 0; // 0 or 1 (which genome slot we're testing across all NPCs)
const genomeTestWindow = 30; // 30 seconds per genome slot
let roundRunning = false;
let roundTransitioning = false; // Flag to prevent continueRound from being called multiple times
let animationActive = false; // Flag to track if the animation loop is active
let roundMetrics = [];
let playerStats = {
    startTime: 0,
    timeSurvived: 0,
    jumpCount: 0,
    turnAmount: 0,
    score: 0,
    ballsThrown: 0,
    targetsHit: 0,
    safeFrames: 0,
    totalFrames: 0,
    actionLatencies: []
};
// Array of metrics for each of the 3 NPCs (one object per NPC, reset each round)
let npcMetricsArray = [];
let generationalPopulation = new Population(6);
let allGenerationsCSVData = []; // Accumulate CSV data across all generations
export const collisionState = {
    lastPlayerEnemyCollisionTime: 0
};
export const COLLISION_COOLDOWN = 0.5;
//-----END GLOBAL VARIABLES-----//

//-----SETUP-----//
let timer = new THREE.Timer(); // Re-initialized in startRound() to ensure proper reset each round
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
// Add Spheres //
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
// npcIndex indicates which of the 3 NPCs threw the ball
function npcSpawnBall(origin, velocity, npcIndex) {
    const s = spheres[sphereIdx];
    s.mesh.visible = true;
    s.collider.center.copy(origin);
    s.mesh.position.copy(origin);
    s.velocity.copy(velocity);
    s.throwerNpcIndex = npcIndex; // Track which NPC (0-2) threw this ball
    const ballThrown = sphereIdx;
    sphereIdx = (sphereIdx + 1) % spheres.length;
    return ballThrown;
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
// Add Targets //
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

// Add Lights Using Skybox //
new HDRLoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    //scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
let player = new Player();
//console.log("Player created after world load: ", player.direction); //Debug Line
let npcs = []; // Array of 3 NPC instances
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
        // Create 3 NPCs after the world is loaded to ensure they have access to the octree for navigation
        npcs = [];
        for (let i = 0; i < NUM_NPCS; i++) {
            const npc = new NPC({ scene, startPos: new THREE.Vector3(5 + i * 3, 0.75, 5 + i) });
            npcs.push(npc);
        }
    });
// Add Snowflake Points //
const points = addSFPoints();
points.position.set(-23, -4, -23);
scene.add(points);
//-----END ADD GAME OBJECTS-----//

//-----ADD SCORE DISPLAY-----//
const scoreDisplay = document.createElement('div');
scoreDisplay.id = 'score'; // Add an ID for easy access
scoreDisplay.innerText = `Player Score: ${0}
        NPC 1 Score: ${0}
        NPC 2 Score: ${0}
        NPC 3 Score: ${0}`; // Initial score display
document.body.appendChild(scoreDisplay);
const roundDisplay = document.createElement('div');
roundDisplay.id = 'round-display';
roundDisplay.innerText = `Generation: ${generationsCompleted + 1}`;
document.body.appendChild(roundDisplay);
// Update Score Display Function
export function updateScoreDisplay(score) {
    if (roundRunning) {
        console.log("Score updated:", score.counter); // Debugging line
        console.log("NPC Score updated:", score.npcCounter1); // Debugging line
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            console.log("Score element found!"); // Debugging line
            scoreElement.innerText = `Player Score: ${player.score}
            NPC 1 Score: ${score.npcCounter1}
            NPC 2 Score: ${score.npcCounter2}
            NPC 3 Score: ${score.npcCounter3}`;
        } else {
            console.error("Score element not found!");
        }
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
function startTimer() {
    console.log("StartTimer called, starting timer..."); // Debugging line
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
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
            else {
                //console.log("Round complete. Completing generation..."); // Debugging line to confirm round end when timer runs out
                console.log("Timer reached 0, all generations completed.");
                roundRunning = false; // Signal animate loop to stop
                cancelAnimationFrame(animationFrameId); // Cancel pending animation frame
                animationActive = false;
                endGame();
                return;
            }
        }
    }, 100); // Update more frequently for accuracy
}
//-----END ADD TIMER-----//

//-----CREATE ROUND COUNTDOWN-----//
const roundCountdown = document.createElement('div');
roundCountdown.id = 'round-countdown';
function showRoundCountdownScreen() {
    roundCountdown.style.display = 'flex';
    roundCountdown.textContent = `Initializing Round ${generationsCompleted + 2}...`;
}
function showRoundCountdown(seconds, onFinish) {
    if (!roundCountdown.parentElement) {
        document.body.appendChild(roundCountdown);
    }
    startScreen.style.display = 'none'; // Hide the start screen during countdown if it's still visible
    roundCountdown.style.display = 'flex';
    let value = seconds;
    roundCountdown.textContent = `Round ${generationsCompleted + 1} in ${value}`;
    const timerId = setInterval(() => {
        value -= 1;
        if (value > 0) {
            roundCountdown.textContent = `Round ${generationsCompleted + 1} in ${value}`;
        } else {
            clearInterval(timerId);
            roundCountdown.style.display = 'none';
            onFinish();
        }
    }, 1000);
}
//-----END CREATE ROUND COUNTDOWN-----//

//-----ADD MUSIC-----//
const backgroundMusic = document.createElement('audio');
backgroundMusic.src = './assets/Gemtracks-Smurf-Speed.mp3';
backgroundMusic.loop = true; // Loop the music
backgroundMusic.volume = 0.15; // Set the volume (0.0 to 1.0)
const muteButton = document.createElement('button');
muteButton.id = 'mute-button';
muteButton.innerText = 'Mute';
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
        animationActive = false;
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
//----- Start The Game When The Button Is Clicked -----//
startButton.addEventListener('click', () => {
    if (document.pointerLockElement) {
        console.log("Pointer lock is active. Disabling it now...");
        document.exitPointerLock();
    } else {
        console.log("Pointer lock is not active.");
    }
    console.log("Start button clicked. Starting game...");
    showRoundCountdownScreen(); // Show initializing round screen while NPCs prepare
    //startScreen.style.display = 'none'; // Hide the start screen
    backgroundMusic.play(); // Start the background music
    //roundRunning = true;
    genomeSlotInRound = 0; // Start with slot 0 genomes
    resetMetricsForNextGenome(); // Initialize metrics with proper startTime for first round
    player.score = 0; // Reset player score
    for (let i =0; i < NUM_NPCS; i++) {
        npcs[i].score = 0; // Reset all NPC scores
    }
    startRound(true); // Show countdown for first slot
});
//-----END START GAME-----//
function shuffleGenomes(generaltionalPopulation) {
    for (let i = generaltionalPopulation.genomes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [generaltionalPopulation.genomes[i], generaltionalPopulation.genomes[j]] = [generaltionalPopulation.genomes[j], generaltionalPopulation.genomes[i]];
    }
}
//-----START ROUND LOGIC-----//
function startRound(showCountdown = true) {
    roundTransitioning = false;
    // Shuffle genomes only once at the start of each generation
    if (genomeSlotInRound === 0) {
        shuffleGenomes(generationalPopulation);
    }
    // Assign genomes
    for (let i = 0; i < NUM_NPCS; i++) {
        const genomeIndex = i * GENOMES_PER_NPC + genomeSlotInRound;
        const genome = generationalPopulation.genomes[genomeIndex];
        npcs[i].behavior = genome.behavior;
        // Reset NPC state for new round
        npcs[i].targetIndex = -1;
        npcs[i].actionLatencies.length = 0;
        npcs[i].framesSinceTargetDetection = 0;
        npcs[i].hasActed = false; // Reset initialization flag to allow NPCs to re-initialize with new behavior
    }
    // Start animation loop that checks for NPC initialization before starting the timer and gameplay
    if (!animationActive) {
        animationActive = true;
        animate(); // Start the animation loop to allow NPCs to initialize and run their first frame logic
    }
    // Wait until all NPCs are ready before starting the timer and animation loop
    waitForNPCInitialization(() => {
        beginCountdownAndRound(showCountdown);
    });
}
function waitForNPCInitialization(callback) {
    const MIN_WARMUP_MS = 4000;
    let roundInitStartTime = performance.now();
    const check = () => {
        const allReady = npcs.every(npc => npc.hasActed) && (performance.now() - roundInitStartTime > MIN_WARMUP_MS);
        if (allReady) {
            console.log("All NPCs initialized, starting round...");// Debugging line to confirm all NPCs are ready before starting
            callback();
        } else {
            requestAnimationFrame(check);
        }
    };
    check();
}
function beginCountdownAndRound(showCountdown) {
    timer = new THREE.Timer();
    timer.getDelta();
    lastFrameTime = performance.now();
    frameCount = 0;
    deltaTimeSum = 0;
    isFirstFrameOfRound = true;
    roundDisplay.innerText = `Generation: ${generationsCompleted + 1}
    Slot: ${genomeSlotInRound + 1}/2`;
    if (showCountdown) {
        showRoundCountdown(3, () => startGameplay(showCountdown));
    } else {
        startGameplay();
    }
}
function startGameplay(showCountdown) {
    roundRunning = true;
    console.log("Gameplay started and round running set to TRUE");
    resetNpcPosition(); // Ensure NPCs are in the correct starting positions for the round
    if (backgroundMusic.paused) {
        backgroundMusic.play();
    }
    for (let i = 0; i < NUM_NPCS; i++) {
        npcMetricsArray[i].startTime = performance.now();
    }
    if (showCountdown) {
        // Set startTime AFTER countdown finishes, right when gameplay begins
        startTimer();
    }
    playerStats.startTime = performance.now();
}
// New function for round state logic: start, end, reset
/*function startRound(showCountdown = true) {
    roundTransitioning = false;
    // Assign genomes to all 3 NPCs based on current slot (0 or 1)
    // NPC 0 tests genomes 0-1, NPC 1 tests genomes 2-3, NPC 2 tests genomes 4-5
    for (let i = 0; i < NUM_NPCS; i++) {
        const genomeIndex = i * GENOMES_PER_NPC + genomeSlotInRound;
        const genome = generationalPopulation.genomes[genomeIndex];
        npcs[i].behavior = genome.behavior;
        npcs[i].targetIndex = -1;
        npcs[i].actionLatencies.length = 0;
        npcs[i].framesSinceTargetDetection = 0;
        npcs[i].isInitialized = false; // Reset initialization flag to allow NPCs to re-initialize with new behavior
    }
    // Create fresh timer //
    timer = new THREE.Timer();
    timer.getDelta();
    lastFrameTime = performance.now();
    frameCount = 0;
    deltaTimeSum = 0;
    isFirstFrameOfRound = true;
    roundDisplay.innerText = `Generation: ${generationsCompleted + 1}/${MAX_GENERATIONS}
    Slot: ${genomeSlotInRound + 1}/2`;
    if (showCountdown) {
        showRoundCountdown(3, () => {
            roundRunning = true;
            if (backgroundMusic.paused) {
                backgroundMusic.play();
            }
            // Set startTime AFTER countdown finishes, right when gameplay begins
            for (let i = 0; i < NUM_NPCS; i++) {
                npcMetricsArray[i].startTime = performance.now();
            }
            startTimer();
            playerStats.startTime = performance.now();
            animate();
        });
    } else {
        roundRunning = true;
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        }
        // Set startTime right when slot 1 gameplay begins (no countdown)
        for (let i = 0; i < NUM_NPCS; i++) {
            npcMetricsArray[i].startTime = performance.now();
        }
        playerStats.startTime = performance.now();
        animate();
    }
}*/
function updateMetrics() {
    // Player metrics (collected once, shared across all NPCs)
    playerStats.safeFrames = player.safeFrames || 0; // Ensure safeFrames is defined
    const playerTimeSurvived = Math.max(playerStats.timeSurvived, 0.001);
    const playerTotalFrames = Math.max(playerStats.totalFrames, 1);
    const playerThrowFrequency = playerStats.ballsThrown > 0 ? playerTimeSurvived / playerStats.ballsThrown : 0;
    const playerAvoidanceRatio = playerStats.safeFrames / playerTotalFrames;
    const playerAvgActionLatency = playerStats.actionLatencies.length > 0 
        ? playerStats.actionLatencies.reduce((a,b)=>a+b) / playerStats.actionLatencies.length 
        : 0;
    
    // For each NPC, create a metrics entry (one per genome tested)
    for (let npcIdx = 0; npcIdx < NUM_NPCS; npcIdx++) {
        const npcStats = npcMetricsArray[npcIdx];
        // Calculate genome index based on NPC index and current slot
        const genomeIndex = npcIdx * GENOMES_PER_NPC + genomeSlotInRound;
        const genome = generationalPopulation.genomes[genomeIndex];
        const genomeId = genome.id;
        // NPC metrics for this slot
        const npcTimeSurvived = Math.max(npcStats.timeSurvived, 0.001);
        const npcTotalFrames = Math.max(npcStats.totalFrames, 1);
        // Calculate derived NPC behavior metrics
        const npcThrowFrequency = npcStats.ballsThrown > 0 ? npcTimeSurvived / npcStats.ballsThrown : 0;
        const npcAvoidanceRatio = npcStats.safeFrames / npcTotalFrames;
        const npcAvgActionLatency = npcStats.actionLatencies.length > 0
            ? npcStats.actionLatencies.reduce((a,b)=>a+b) / npcStats.actionLatencies.length
            : 0;
        console.log(`[SLOT ${genomeSlotInRound} NPC ${npcIdx}] Genome ${genomeIndex}: Throws: ${npcStats.ballsThrown}, Targets: ${npcStats.targetsHit}, Jumps: ${npcStats.jumpCount}`);
        roundMetrics.push({
            round: currentRound,
            slot: genomeSlotInRound,
            npcIndex: npcIdx,
            genomeIndex: genomeIndex,
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
                //closestEnemyDistance: playerStats.closestEnemyDistance,
                //averageEnemyDistance: playerStats.averageEnemyDistance,
                avgActionLatency: playerAvgActionLatency,
                //timeAvoidingEnemies: playerStats.timeSpentAvoidingEnemies
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
                npcVsPlayerJumpRatio: playerStats.jumpCount > 0 ? (npcStats.jumpCount / npcTimeSurvived) / (playerStats.jumpCount / playerTimeSurvived) : 0,
                npcVsPlayerThrowRatio: playerStats.ballsThrown > 0 ? (npcStats.ballsThrown / npcTimeSurvived) / (playerStats.ballsThrown / playerTimeSurvived) : 0,
                npcVsPlayerAvoidanceRatio: playerAvoidanceRatio > 0 ? npcAvoidanceRatio / playerAvoidanceRatio : 0,
                npcVsPlayerTurnRatio: playerStats.turnAmount > 0 ? (npcStats.turnAmount / npcTimeSurvived) / (playerStats.turnAmount / playerTimeSurvived) : 0,
                scoreRatio: playerStats.score > 0 ? npcStats.score / playerStats.score : 0
            }
        });
    }
    
    console.log(`[SLOT ${genomeSlotInRound} SAVED] Created 3 metrics entries for genomes ${genomeSlotInRound === 0 ? '0,2,4' : '1,3,5'}`);
}
function resetRound() {
    resetNpcPosition();
    player.collider.start.set(0,0.35,0);
    player.collider.end.set(0,1,0);
    player.velocity.set(0,0,0);
    player.jumpCount = 0; // Reset player jump counter
    score.counter = 0;
    score.npcCounter1 = 0;
    score.npcCounter2 = 0;
    score.npcCounter3 = 0;
    player.score = 0; // Reset player score
    for (let i = 0; i < NUM_NPCS; i++) {
        npcs[i].score = 0; // Reset all NPC scores
    }
    updateScoreDisplay(score);
    repositionEnemies();
    repositionTargets();
}
// Reposition existing enemies without creating new ones //
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
// Reposition existing targets without creating new ones //
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
    // Reset all 3 NPCs
    for (let i = 0; i < NUM_NPCS; i++) {
        const npc = npcs[i];
        npc.collider.start.set(0.6 + i * 2, 0.35, 0.6 + i);
        npc.collider.end.set(0.6 + i * 2, 1, 0.6 + i);
        npc.velocity.set(0, 0, 0);
        npc.framesSinceTargetDetection = 0;
        npc.lastActionLatency = 0;
        npc.actionLatencies.length = 0;
        npc.targetsHit = 0;
        npc.jumpCount = 0;
        npc.turnAmount = 0;
        npc.ballsThrown = 0;
        npc.lastJump = 0;
        npc.lastThrow = 0;
        npc.targetIndex = -1;
        npc.lastTargetIndex = 0;
        npc.mesh.position.copy(npc.getCenter());
    }
}
function resetMetricsForNextGenome() {
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
        actionLatencies: []
    };
    setCurrentPlayerStats(playerStats);
    // Initialize metrics array for 3 NPCs
    npcMetricsArray = [];
    for (let i = 0; i < NUM_NPCS; i++) {
        npcMetricsArray.push({
            startTime: performance.now(),
            timeSurvived: 0,
            targetsHit: 0,
            safeFrames: 0,
            totalFrames: 0,
            actionLatencies: [],
            jumpCount: 0,
            turnAmount: 0,
            score: 0
        });
    }
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
        'PlayerSafeFrames', //Remove since avoidance ratio is not being used 
        'PlayerTotalFrames', // Remove since avoidance ratio is not being used
        'PlayerAvoidanceRatio', // Remove since avoidance ratio is not being used
        //'PlayerClosestEnemyDist',
        //'PlayerAvgEnemyDist',
        'PlayerAvgActionLatency',
        //'PlayerTimeAvoidingEnemies',
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
        // Genome Fitness and Component Values
        'GenomeFitness',
        'Competitive',
        //'Closeness',
        'Adaptability',
        'Behavioral',
        'Responsiveness',
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
        'NPCvsPlayerAvoidanceRatio',// Remove since avoidance ratio is not being used
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
            metric.player.safeFrames,// Remove since avoidance ratio is not being used
            metric.player.totalFrames,// Remove since avoidance ratio is not being used
            metric.player.avoidanceRatio.toFixed(4),
            //metric.player.closestEnemyDistance.toFixed(2),
            //metric.player.averageEnemyDistance.toFixed(2),
            metric.player.avgActionLatency.toFixed(4),
            //metric.player.timeAvoidingEnemies.toFixed(2),
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
            // Genome fitness and components
            genome.fitness.toFixed(4),
            genome.metrics.competitive.toFixed(4),
            //genome.metrics.closeness.toFixed(4),
            genome.metrics.adaptability.toFixed(4),
            genome.metrics.behavioral.toFixed(4),
            genome.metrics.responsiveness.toFixed(4),
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
            metric.behaviorComparison.npcVsPlayerAvoidanceRatio.toFixed(4),// Remove since avoidance ratio is not being used
            metric.behaviorComparison.npcVsPlayerTurnRatio.toFixed(4),
            metric.behaviorComparison.scoreRatio.toFixed(4)
        ];
    });
    // Accumulate data //
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
//-----Function to complete one generation once each round is played-----//
function completeGeneration() {
    console.log("=== COMPLETING GENERATION ===");
    console.log("roundMetrics length:", roundMetrics.length);
    if (roundMetrics.length > 0) {
        console.log("First metric sample:", roundMetrics[0]);
    }
    generationalPopulation.evaluateFitness(roundMetrics);
    generationsCompleted += 1;
  if (generationsCompleted < MAX_GENERATIONS) {
        exportMetricsToCSV();
        // Find the two best genomes and protect them (elitism)
        const bestGenomeIndex = generationalPopulation.findBestGenomeIndex();
        const secondBestGenomeIndex = generationalPopulation.findSecondBestGenomeIndex(bestGenomeIndex);
        console.log("Best genome index:", bestGenomeIndex, "with fitness:", generationalPopulation.genomes[bestGenomeIndex].fitness);
        console.log("Second best genome index:", secondBestGenomeIndex, "with fitness:", generationalPopulation.genomes[secondBestGenomeIndex].fitness);
        console.log("=== BEFORE EVOLUTION Gen", generationsCompleted, "===");
        generationalPopulation.genomes.forEach((g, i) => {
            console.log(`Genome ${i}:`, {id: g.id, jumpFreq: g.behavior.jumpFrequency, ballPower: g.behavior.ballThrowPower, fitness: g.fitness});
        });
        // Evolve population: keep two best genomes, replace bottom 4 with evolved children
        const worstIndices = generationalPopulation.getIndicesOfWorstGenomes(bestGenomeIndex, secondBestGenomeIndex, 4);
        console.log("Worst genome indices to replace:", worstIndices);
        worstIndices.forEach((worstIndex, iteration) => {
            console.log(`Evolving child ${iteration+1} of 4... replacing genome at index ${worstIndex}`);
            // Tournament selection: pick 2 parents from the population
            const parent1Obj = generationalPopulation.tournamentSelection();
            let parent2Obj = generationalPopulation.tournamentSelection();
            // Extract the genome objects (tournamentSelection returns {genome, index, fitness})
            const parent1 = parent1Obj.genome;
            const parent2 = parent2Obj.genome;
            //Prevent Identical Parents
            let attempts = 0;
            while (parent2Obj.index === parent1Obj.index && attempts < 5) {
                parent2Obj = generationalPopulation.tournamentSelection();
                attempts++;
            }
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
            console.log(`Genome ${i}:`, {id: g.id, jumpFreq: g.behavior.jumpFrequency, ballPower: g.behavior.ballThrowPower, ballThrowFrequency: g.behavior.ballThrowFrequency, selectionRadius: g.behavior.targetSelectionRadius, enemyAvoidance: g.behavior.enemyAvoidanceDistance, speedMultiplier: g.behavior.movementSpeedMultiplier, fitness: g.fitness, competitive: g.metrics.competitive, adaptability: g.metrics.adaptability, behavioral: g.metrics.behavioral, responsiveness: g.metrics.responsiveness});
        });
        currentRound = 1;
        genomeSlotInRound = 0;
        roundMetrics = [];
        resetMetricsForNextGenome();
        resetRound();
        roundRunning = false;
        startRound(true); // Show countdown for new generation
    } else {
        exportMetricsToCSV();
        downloadAllGenerationsCSV();
        console.log("Current Population Genome Fitness Values: ", generationalPopulation.fitnessScores);
        endGame();
    } 
}
function collectLiveMetrics(deltaTime) {
    // Collect player metrics
    playerStats.timeSurvived = (performance.now() - playerStats.startTime) / 1000;
    playerStats.jumpCount = player.jumpCount;
    playerStats.turnAmount += Math.abs(camera.rotation.y - lastCameraY);
    playerStats.score = player.score;
    playerStats.totalFrames += 1;
    lastCameraY = camera.rotation.y;
    // Collect metrics for all 3 NPCs
    for (let i = 0; i < NUM_NPCS; i++) {
        const npc = npcs[i];
        const stats = npcMetricsArray[i];
        stats.timeSurvived = (performance.now() - stats.startTime) / 1000;
        stats.targetsHit = npc.targetsHit;
        stats.totalFrames += 1;
        if (npc.isNpcFarFromAllEnemies(enemies)) {
            stats.safeFrames += 1;
        }
        stats.score = npc.score;
        if (npc.lastActionLatency != null) {
            stats.actionLatencies.push(npc.lastActionLatency);
            npc.lastActionLatency = null;
        }
        stats.ballsThrown = npc.ballsThrown;
        stats.jumpCount = npc.jumpCount;
        stats.turnAmount = npc.turnAmount;
    }
    // Check if ANY NPC has completed the 30-second test window
    if (npcMetricsArray.length > 0 && npcMetricsArray[0].timeSurvived >= genomeTestWindow && !roundTransitioning) {
        roundTransitioning = true;
        continueRound();
    }
}
export function continueRound() {
    updateMetrics();
    if (genomeSlotInRound < GENOMES_PER_NPC - 1) {
        // Move to next slot (0 -> 1)
        genomeSlotInRound += 1;
        resetMetricsForNextGenome();
        for (let i = 0; i < NUM_NPCS; i++) {
            npcs[i].score = 0;
        }
        resetNpcPosition();
        console.log(`Starting next slot: ${genomeSlotInRound} for all NPCs`); // Debugging line to confirm slot transition
        startRound(false); // false = don't show countdown for slot transition
    } else {
        // All slots tested, complete generation
        showRoundCountdownScreen();
        genomeSlotInRound = 0; // Reset for next generation
        completeGeneration();
    }
}
//-----GAME ANIMATION LOOP-----//
let animationFrameId; // Global variable to store the animation frame ID
let lastCameraY = 0;
function animate() {
    // Check if we should stop the animation loop
    if (!animationActive) {
        return;
    }
    //if(!roundRunning) {
      //  cancelAnimationFrame(animationFrameId);
        //return;
    //}
    // Always request next frame for smooth display
    animationFrameId = requestAnimationFrame(animate);
    // Calculate actual elapsed time since last update
    const currentFrameTime = performance.now();
    const elapsedSinceLastUpdate = currentFrameTime - lastFrameTime;
    // Skip physics update if not enough time has passed (120fps throttle = ~8.33ms min per frame)
    if (elapsedSinceLastUpdate < TARGET_FRAME_TIME && !isFirstFrameOfRound) {
        return; // Skip this frame, will render on next RAF callback
    }
    //console.log("Animation loop running...");
    animatePoints(points);
    // Calculate deltaTime for physics update
    let rawDelta = elapsedSinceLastUpdate / 1000; // Convert ms to seconds
    lastFrameTime = currentFrameTime;
    //console.log(`Frame time delta: ${rawDelta.toFixed(4)}s (throttled to ${TARGET_FPS}fps)`);
    // Handle first frame (may have unusual timing due to UI countdown)
    if (isFirstFrameOfRound) {
        console.log("First frame detected, using default deltaTime");
        rawDelta = TARGET_FRAME_TIME / 1000; // Use target frame time for first frame
        isFirstFrameOfRound = false;
    }
    let deltaTime = Math.min( 0.05, rawDelta ) / STEPS_PER_FRAME;
    //console.log(`Calculated deltaTime for this frame: ${deltaTime.toFixed(4)} seconds`);//Debugging line to check final delta time used in updates
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
    if (roundRunning) {
        collectLiveMetrics(deltaTime);
    }
    //collectLiveMetrics(deltaTime);
    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.
    const elapsedTimeInRound = (performance.now() - roundStartTime) / 1000; // Seconds elapsed since round started
    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
        controls(keyStates, camera, deltaTime, player);
        updatePlayer(deltaTime, worldOctree, GRAVITY, camera, player);
        updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, vector1, vector2, vector3, player);
        updateEnemiesAndTargets(deltaTime, enemies, targets, enemyAndTargetBounds);
        // Update all 3 NPCs
        for (let npcIdx = 0; npcIdx < NUM_NPCS; npcIdx++) {
            const npc = npcs[npcIdx];
            npc.update(deltaTime, worldOctree, targets, enemies, (pos, vel) => npcSpawnBall(pos, vel, npcIdx), elapsedTimeInRound, GRAVITY, roundRunning);
            if (roundRunning) {
                checkForEnemyCollisions(npc.collider, enemies, camera, player, score, npc, npcIdx);
                teleportPlayerIfOob(camera, npc.collider, npc, player);
            }
            if (roundRunning) {
                console.log("Round Running set to TRUE, ball target collision check active");
                checkBallTargetCollisions(spheres, targets, score, npcs, worldOctree, player, playerStats);
            }
        }
        stats.update();
        renderer.render(scene, camera);
    }
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
    animationActive = false;
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
    finalScore.innerText = `Final Player Score: ${score.counter}
    NPC 1 Score: ${score.npcCounter1}
    NPC 2 Score: ${score.npcCounter2}
    NPC 3 Score: ${score.npcCounter3}`;
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
    animationActive = false;
    console.log("Restarting game..."); // Debugging line
    // Reset metrics and generation tracking
    allGenerationsCSVData = [];
    generationsCompleted = 0;
    currentRound = 1;
    genomeSlotInRound = 0;
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
    score.npcCounter1 = 0;
    score.npcCounter2 = 0;
    score.npcCounter3 = 0;
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
    // Reset all 3 NPCs
    for (let i = 0; i < NUM_NPCS; i++) {
        const npc = npcs[i];
        npc.collider.start.set(0.6 + i * 2, 0.35, 0.6 + i);
        npc.collider.end.set(0.6 + i * 2, 1, 0.6 + i);
        npc.velocity.set(0, 0, 0);
        npc.targetIndex = -1; // Reset target index to force new target selection
        npc.lastThrow = 0; // Reset throw timer
        npc.lastJump = 0; // Reset jump timer
        npc.lastBallIndex = 0; // Reset ball index for tracking thrown balls
        npc.onFloor = false; // Reset on-floor state
        npc.baseSpeed = 2.5; // Reset base movement speed
        npc.mesh.position.copy(npc.getCenter()); // Ensure NPC mesh is positioned correctly
    }
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