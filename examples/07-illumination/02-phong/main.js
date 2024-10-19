import { GUI } from 'dat';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';
import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { TouchController } from 'engine/controllers/TouchController.js';

import {
    Camera,
    Model,
    Node,
    Transform,
} from 'engine/core.js';

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

function update(time, dt) {
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(time, dt);
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
gui.add(renderer, 'perFragment');

const lightSettings = light.getComponentOfType(Light);
const lightFolder = gui.addFolder('Light');
lightFolder.open();
lightFolder.add(lightSettings, 'intensity', 0, 5);
lightFolder.addColor(lightSettings, 'color');

const lightTransform = light.getComponentOfType(Transform);
const lightPosition = lightFolder.addFolder('Position');
lightPosition.open();
lightPosition.add(lightTransform.translation, 0, -10, 10).name('x');
lightPosition.add(lightTransform.translation, 1, -10, 10).name('y');
lightPosition.add(lightTransform.translation, 2, -10, 10).name('z');

const lightAttenuation = lightFolder.addFolder('Attenuation');
lightAttenuation.open();
lightAttenuation.add(lightSettings.attenuation, 0, 0, 5).name('constant');
lightAttenuation.add(lightSettings.attenuation, 1, 0, 2).name('linear');
lightAttenuation.add(lightSettings.attenuation, 2, 0, 1).name('quadratic');

const materialFolder = gui.addFolder('Material');
materialFolder.open();
materialFolder.add(material, 'diffuse', 0, 1);
materialFolder.add(material, 'specular', 0, 1);
materialFolder.add(material, 'shininess', 1, 200);
