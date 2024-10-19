import { quat } from 'glm';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { ImageLoader } from 'engine/loaders/ImageLoader.js';
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import {
    Node,
    Camera,
    Texture,
    Transform,
    Sampler,
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
light.addComponent(new Light({
    decalTexture: new Texture({
        image: await new ImageLoader().load(new URL('decal.webp', import.meta.url)),
        sampler: new Sampler(),
    }),
}));
light.addComponent(new Camera({
    near: 1,
    far: 20,
    fovy: 0.5,
}));
light.addComponent(new Transform({
    translation: [0, 1, 2],
}));
light.addComponent({
    update(t) {
        const transform = light.getComponentOfType(Transform);
        transform.translation[0] = Math.sin(t);
        transform.rotation = quat.create()
            .rotateX(-0.5)
            .rotateY(Math.sin(t) * 0.5);
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
