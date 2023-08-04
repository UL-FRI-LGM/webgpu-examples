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
} from '../../../common/engine/core.js';

import { quat } from '../../../lib/gl-matrix-module.js';

import { ImageLoader } from '../../../common/engine/loaders/ImageLoader.js';
import { GLTFLoader } from '../../../common/engine/loaders/GLTFLoader.js';

import { ResizeSystem } from '../../../common/engine/systems/ResizeSystem.js';
import { UpdateSystem } from '../../../common/engine/systems/UpdateSystem.js';

import { Renderer } from './Renderer.js';

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('../../../common/models/monkey.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = gltfLoader.loadNode('Camera');

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const imagedata = new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1 ,1);
const image = await createImageBitmap(imagedata);
const texture = new Texture({
    image: image,
    sampler: new Sampler(),
});
const model = gltfLoader.loadNode('Suzanne');
const material = model.getComponentOfType(Model).primitives[0].material;
material.baseTexture = texture;

material.normalTexture = new Texture({
    image: await new ImageLoader().load('../../../common/images/crate-normal.png'),
    sampler: new Sampler({
        addressModeU: 'repeat',
        addressModeV: 'repeat',
    }),
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
