import * as THREE from 'three';
import { addControls } from './orbitControls.js'; 
import { createScene, createCamera, createRenderer } from './sceneSetup.js';
import { addLights } from './lights.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { addStaircase, addPlatform, addPillar } from './geometries.js';
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
scene.fog = new THREE.FogExp2(0x000000, 0.002);
//-----LIGHTS-----//
//addLights(scene);
//-----CONTROLS-----//
const orbitControls = addControls(camera, renderer.domElement);
scene.add(orbitControls);
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
//-----LOAD MODEL-----//
const loader = new GLTFLoader();
loader.load('./assets/collision-world.glb', ( gltf ) => {
        gltf.scene.scale.set(30, 30, 30);
        scene.add( gltf.scene );
        gltf.scene.traverse( ( child ) => {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
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
    renderer.render(scene, camera);
};
animate();
