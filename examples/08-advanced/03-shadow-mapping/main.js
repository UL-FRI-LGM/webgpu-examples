import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { ImageLoader } from 'engine/loaders/ImageLoader.js';
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import {
    Node,
    Camera,
    Transform,
} from 'engine/core.js';

import { TouchController } from 'engine/controllers/TouchController.js';

import { Light } from './Light.js';
import { Renderer } from './Renderer.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('../../../models/monkey/monkey.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = gltfLoader.loadNode('Camera');
camera.addComponent(new TouchController(camera, canvas, { distance: 5 }));

const light = new Node();
light.addComponent(new Light());
light.addComponent(new Camera({
    near: 5,
    far: 20,
    fovy: 0.3,
}));
light.addComponent(new Transform({
    translation: [0, 0, 15],
}));
light.addComponent({
    update(t) {
        const transform = light.getComponentOfType(Transform);
        transform.translation[0] = Math.sin(t * 10);
    }
})
scene.addChild(light);

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
