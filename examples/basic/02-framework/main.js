import { quat } from '../../../lib/gl-matrix-module.js';

import { Camera } from '../../../common/engine/core.js';

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
