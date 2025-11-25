import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
import { Camera, Entity, Transform } from 'engine/core/core.js';
import { OrbitController } from 'engine/controllers/OrbitController.js';

import { loadAnimations } from './GLTFAnimationUtils.js';


const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

const loader = new GLTFLoader();
await loader.load(new URL('../../../models/animated_cube/AnimatedCube.gltf', import.meta.url));

const scene = loader.loadScene();

const camera = new Entity();
camera.addComponent(new Camera());
camera.addComponent(new Transform({
    translation: [0, -10, -10]
}));
camera.addComponent(new OrbitController(camera, canvas, {
    distance: 10,
}));
scene.push(camera);

loadAnimations(loader, scene);

function update(t, dt) {
    for (const entity of scene) {
        for (const component of entity.components) {
            component.update?.(t, dt);
        }
    }
}

function render() {
    renderer.render(scene, camera);
}

function resize({ displaySize: { width, height } }) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();