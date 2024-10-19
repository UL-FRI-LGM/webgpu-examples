import { GUI } from 'dat';

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

import { TouchController } from 'engine/controllers/TouchController.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { Renderer } from './Renderer.js';

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
material.reflectance = 1;
material.transmittance = 1;
material.ior = 0.75;
material.effect = 0;

const imageLoader = new ImageLoader();
const environmentImages = await Promise.all([
    'px.webp',
    'nx.webp',
    'py.webp',
    'ny.webp',
    'pz.webp',
    'nz.webp',
].map(url => imageLoader.load(url)));
renderer.setEnvironment(environmentImages);

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
gui.add(material, 'reflectance', 0, 1);
gui.add(material, 'transmittance', 0, 1);
gui.add(material, 'ior', 0, 1);
gui.add(material, 'effect', 0, 1);
