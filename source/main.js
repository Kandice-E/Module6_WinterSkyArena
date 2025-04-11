import * as THREE from 'three';
import { addControls } from './orbitControls.js'; 
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import { addLights } from './lights.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addStaircase, addPlatform } from './geometries.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';

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

scene.fog = new THREE.FogExp2(0x000000, 0.003);
//-----LIGHTS-----//
addLights(scene);
//-----CONTROLS-----//
const orbitControls = addControls(camera, renderer.domElement);
scene.add(orbitControls);

//-----AXIS HELPER-----//
const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);
//-----GRID HELPER-----//
const gridHelper = new THREE.GridHelper(1200, 50, 0x0000ff, 0x808080);
scene.add(gridHelper);

//-----PLANES-----//
const wallWidth = 1000;
const wallHeight = 250;
const planeGeometry = new THREE.PlaneGeometry(wallWidth, wallHeight, 10, 10);
const planeMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00, side: THREE.DoubleSide});
const wall1 = new THREE.Mesh(planeGeometry, planeMaterial);
const wall2 = wall1.clone();
const wall3 = wall1.clone();
const wall4 = wall1.clone();
wall1.position.set(0, wallHeight / 2, -wallWidth / 2);
wall2.position.set(0, wallHeight / 2, wallWidth / 2);
wall3.position.set(-wallWidth / 2, wallHeight / 2, 0);
wall4.position.set(wallWidth / 2, wallHeight / 2, 0);
wall3.rotation.y = Math.PI / 2;
wall4.rotation.y = Math.PI / 2;
scene.add(wall1);
scene.add(wall2);
scene.add(wall3);
scene.add(wall4);

//-----FLOOR-----//
const floorWidth = wallWidth;
const floorHeight = wallWidth;
const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorHeight, 10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({color: 0x808080, side: THREE.DoubleSide});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, 0);
scene.add(floor);
//-----STAIRCASE-----//
const staircase = addStaircase();
staircase.position.set(0, 0, 0);
scene.add(staircase);
//-----PLATFORM-----//
const platform1 = addPlatform(0, wallHeight / 4, (-wallWidth / 2) + (wallHeight / 8), wallWidth, wallHeight / 2, wallHeight / 4);
scene.add(platform1);
const platform2 = addPlatform(0, wallHeight / 4, (wallWidth / 2) - (wallHeight / 8), wallWidth, wallHeight / 2, wallHeight / 4);
scene.add(platform2);
const platform3 = addPlatform(-wallWidth / 2 + (wallHeight / 8), wallHeight / 4, 0, wallWidth, wallHeight / 2, wallHeight / 4);
platform3.rotation.y = Math.PI / 2;
scene.add(platform3);
const platform4 = addPlatform(wallWidth / 2 - (wallHeight / 8), wallHeight / 4, 0, wallWidth, wallHeight / 2, wallHeight / 4);
platform4.rotation.y = Math.PI / 2;
scene.add(platform4);

//-----SNOWFLAKE SPRITES-----//
const points = addSFPoints();
points.position.set(-wallWidth / 2, -wallHeight / 2, -wallWidth / 2);
scene.add(points);
//-----UPDATE SCENE-----//
function animate() {
    requestAnimationFrame(animate);
    animatePoints(points);
    stats.update();
    orbitControls.update();
    renderer.render(scene, camera);
};
animate();
