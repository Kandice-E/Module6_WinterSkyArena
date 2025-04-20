import * as THREE from 'three';

const vertices = [];
const numSprites = 3000;
const range = 50;
const boundingBox = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(range, range / 2, range));
//Returns A Random Sprite Size Between A Specified Range
function randomSize(minSize, maxSize) {
    let size = Math.random() * (maxSize);
    if (size <= minSize)
    {
        return minSize;
    }
    else if (size >= maxSize)
    {
        return maxSize;
    }
    else
    return size;
};
export function addSFPoints() {
    //Randomly Position Sprites
     for ( let i = 0; i < numSprites; i++ ) {
        const x = Math.random() * range;
        const y = Math.random() * range / 2;
        const z = Math.random() * range;
        let point = new THREE.Vector3(x, y, z);
        vertices.push( point );
    };
    //Create Buffer Geometry From Vertices And Create Color Attribute
    const bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    //Load Snowflake Texture
    const texture = new THREE.TextureLoader().load("./assets/snowflake2.png");
    //Create Points Material
    const pointMaterial = new THREE.PointsMaterial({
        size: randomSize(0.2, 0.6),
        vertexColors: false,
        color: 0xffffff,
        map: texture,
        transparent: true,
        opacity: 0.8,
        alphaTest: 0.01
    });
    //Create Instance Of Point Object Using Buffer Geometry And Point Material
    const points = new THREE.Points(bufferGeometry, pointMaterial);
    return points;
};
export { boundingBox };