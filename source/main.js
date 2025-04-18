import * as THREE from 'three';
import { addControls, controls, eventListeners } from './controls.js'; 
import { updatePlayer, updateSpheres, teleportPlayerIfOob } from './gamePhysics.js';
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import { addLights } from './lights.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addTarget } from './geometries.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';

//-----VARIABLES FOR IMPORT FUNCTIONS-----//
const keyStates = {};
let mouseTime = 0;
const STEPS_PER_FRAME = 5;
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = { onFloor: false };
const GRAVITY = 30;
const NUM_SPHERES = 100;
const SPHERE_RADIUS = 0.2;
const spheres = [];
let sphereIdx = 0;
const playerCollider = new Capsule( new THREE.Vector3( 0, 0.35, 0 ), new THREE.Vector3( 0, 1, 0 ), 0.35 );
const worldOctree = new Octree();
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();
//-----SETUP-----//
const clock = new THREE.Clock();
const scene = createScene();
const camera = createCamera();
//export { camera };
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
//-----ADD CONTROLS-----//
eventListeners(mouseTime, keyStates, camera, spheres, sphereIdx, playerCollider, playerVelocity, playerDirection, playerOnFloor);
//-----FOG-----//
//scene.fog = new THREE.FogExp2(0x100000, 0.001);
scene.fog = new THREE.Fog(0x100000, 0, 35);
//-----LIGHTS-----//
//addLights(scene);
//-----CONTROLS-----//
//const orbitControls = addControls(camera, renderer.domElement);
//const firstPersonControls = addFirstPersonControls(camera, renderer.domElement);
//-----AXIS HELPER-----//
const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);
//-----GRID HELPER-----//
const gridHelper = new THREE.GridHelper(1200, 50, 0x0000ff, 0x808080);
gridHelper.position.y = 0;
//scene.add(gridHelper);
//-----SKYBOX-----//
new RGBELoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
//-----TARGET-----//
const target1 = addTarget();
//scene.add(target1);
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
//-----UPDATE SCENE-----//
function animate() {
    requestAnimationFrame(animate);
    animatePoints(points);
    const deltaTime = Math.min( 0.05, clock.getDelta() ) / STEPS_PER_FRAME;
    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.
    for ( let i = 0; i < STEPS_PER_FRAME; i ++ ) {
        controls(keyStates, playerVelocity, camera, playerDirection, deltaTime, playerOnFloor);
        //camera.updateProjectionMatrix();
        //console.log(camera.position);
        updatePlayer(deltaTime, playerOnFloor, playerVelocity, playerCollider, worldOctree, GRAVITY, camera);
        updateSpheres(deltaTime, spheres, worldOctree, GRAVITY, playerCollider, playerVelocity, vector1, vector2, vector3);
        teleportPlayerIfOob(camera, playerCollider);
        
    }
    stats.update();
    //orbitControls.update();
    //firstPersonControls.update(0.1);
    renderer.render(scene, camera);
};
animate();
