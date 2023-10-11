import { GUI } from '../../../lib/dat.gui.module.js';

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

import { OrbitController } from '../../../common/engine/controllers/OrbitController.js';

import { ResizeSystem } from '../../../common/engine/systems/ResizeSystem.js';
import { UpdateSystem } from '../../../common/engine/systems/UpdateSystem.js';

import { Renderer } from './Renderer.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const gltfLoader = new GLTFLoader();
await gltfLoader.load(new URL('../../../common/models/monkey.gltf', import.meta.url));

const scene = gltfLoader.loadScene(gltfLoader.defaultScene);
const camera = gltfLoader.loadNode('Camera');
camera.addComponent(new OrbitController(camera, canvas, { distance: 7 }));

const model = gltfLoader.loadNode('Suzanne');
const material = model.getComponentOfType(Model).primitives[0].material;

const imageLoader = new ImageLoader();
material.baseTexture = new Texture({
    image: await imageLoader.load('../../../common/images/grass.png'),
    sampler: new Sampler(),
});

material.reflectance = 1;
material.transmittance = 1;
material.ior = 0.75;
material.effect = 0;

const environmentImages = await Promise.all([
    '../../../common/images/px.webp',
    '../../../common/images/nx.webp',
    '../../../common/images/py.webp',
    '../../../common/images/ny.webp',
    '../../../common/images/pz.webp',
    '../../../common/images/nz.webp',
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
