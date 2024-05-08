import {
    Camera,
    Material,
    Mesh,
    Model,
    Node,
    Sampler,
    Texture,
    Transform,
    Vertex,
} from 'engine/core.js';

import { quat } from 'glm';

import { ImageLoader } from 'engine/loaders/ImageLoader.js';
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { Renderer } from './Renderer.js';

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('../../../common/models/monkey.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = gltfLoader.loadNode('Camera');

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const model = gltfLoader.loadNode('Suzanne');
const material = model.getComponentOfType(Model).primitives[0].material;

material.baseTexture = new Texture({
    image: await createImageBitmap(new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1)),
    sampler: new Sampler(),
});

material.normalTexture = new Texture({
    image: await new ImageLoader().load('../../../common/models/monkey-normal.webp'),
    sampler: new Sampler(),
});

function update(t, dt) {
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(t, dt);
        }
    });
}

function render() {
    renderer.render(scene, camera);
}

function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
