import { GUI } from 'dat';

import {
    Camera,
    Model,
    Node,
    Transform,
} from 'engine/core.js';

import { quat } from 'glm';

import { ImageLoader } from 'engine/loaders/ImageLoader.js';
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';

import { TouchController } from 'engine/controllers/TouchController.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { Renderer } from './Renderer.js';
import { Light } from './Light.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('../../../models/monkey/monkey.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = gltfLoader.loadNode('Camera');
camera.addComponent(new TouchController(camera, canvas, { distance: 5 }));

const model = gltfLoader.loadNode('Suzanne');
const material = model.getComponentOfType(Model).primitives[0].material;
material.diffuse = 1;
material.specular = 1;
material.shininess = 50;

const light = new Node();
light.addComponent(new Transform({
    translation: [0, 2, 2],
}));
light.addComponent(new Light({
    intensity: 3,
}));
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

const gui = new GUI();
const lightTransform = light.getComponentOfType(Transform);
const lightPosition = gui.addFolder('Light position');
lightPosition.open();
lightPosition.add(lightTransform.translation, 0, -10, 10).name('x');
lightPosition.add(lightTransform.translation, 1, -10, 10).name('y');
lightPosition.add(lightTransform.translation, 2, -10, 10).name('z');
