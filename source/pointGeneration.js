import * as THREE from 'three';

    const vertices = [];
    const numSprites = 30000;
    const range = 1200;
    const boundingBox = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(range, range / 2, range));

//Returns a random sprite size between a specified range
function randomSize(minSize, maxSize) {
    let size = Math.random() * (maxSize + 1);
    if (size <= minSize)
    {
        return minSize;
    }
    else if (size >= maxSize + 1)
    {
        return maxSize;
    }
    else
    return size;
};
export function addSFPoints() {
    //Randomly position sprites
     for ( let i = 0; i < numSprites; i++ ) {
        const x = Math.random() * range;
        const y = Math.random() * range / 2;
        const z = Math.random() * range;
        let point = new THREE.Vector3(x, y, z);
        vertices.push( point );
    };
    //Create buffer geometry from vertices and create color attribute
    const bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    //Load Snowflake Texture
    const texture = new THREE.TextureLoader().load("./assets/snowflake2.png");
    //Create points material
    const pointMaterial = new THREE.PointsMaterial({
        size: randomSize(1.5, 2),
        vertexColors: false,
        color: 0xffffff,
        map: texture,
        transparent: true,
        opacity: 0.8,
        alphaTest: 0.01
    });
    //Create instance of point object using buffer geometry and point material
    const points = new THREE.Points(bufferGeometry, pointMaterial);

    return points;
};

export { boundingBox };