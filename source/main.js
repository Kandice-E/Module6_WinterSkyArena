import * as THREE from 'three';
import { addControls, addFirstPersonControls } from './orbitControls.js'; 
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import { addLights } from './lights.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addTarget } from './geometries.js';
import { addSFPoints } from './pointGeneration.js';
import { animatePoints } from './spriteAnimation.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
//-----FOG-----//
scene.fog = new THREE.FogExp2(0x100000, 0.001);
//-----LIGHTS-----//
//addLights(scene);
//-----CONTROLS-----//
const orbitControls = addControls(camera, renderer.domElement);
//const firstPersonControls = addFirstPersonControls(camera, renderer.domElement);
//-----AXIS HELPER-----//
const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);
//-----GRID HELPER-----//
const gridHelper = new THREE.GridHelper(1200, 50, 0x0000ff, 0x808080);
scene.add(gridHelper);
//-----SKYBOX-----//
new RGBELoader().load('./assets/belfast_sunset_puresky_2k.hdr', function(skyTexture) {
    skyTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyTexture;
    scene.environment = skyTexture;
    scene.environmentIntensity = 0.5;
})
//-----TARGET-----//
const target1 = addTarget();
scene.add(target1);
//-----LOAD MODEL-----//
const loader = new GLTFLoader();
loader.load('./assets/collision-world.glb', ( gltf ) => {
        gltf.scene.scale.set(30, 30, 30);
        scene.add( gltf.scene );
        gltf.scene.traverse( ( child ) => {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.color.set(0xFC98A8);
            }
        });
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                console.log('Mesh name:', child.name);
            }
        });
    });
//-----SNOWFLAKE SPRITES-----//
const points = addSFPoints();
points.position.set(-1000 / 2, -500 / 2, -1000 / 2);
scene.add(points);
//-----UPDATE SCENE-----//
function animate() {
    requestAnimationFrame(animate);
    animatePoints(points);
    stats.update();
    orbitControls.update();
    //firstPersonControls.update(0.1);
    renderer.render(scene, camera);
};
animate();
