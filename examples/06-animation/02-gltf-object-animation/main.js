import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { GLTFLoader } from 'engine/loaders/GLTFLoader.js';
import { UnlitRenderer } from 'engine/renderers/UnlitRenderer.js';
import { Camera, Entity, Transform } from 'engine/core/core.js';
import { OrbitController } from 'engine/controllers/OrbitController.js';

import { Animation } from './Animation.js';


const canvas = document.querySelector('canvas');
const renderer = new UnlitRenderer(canvas);
await renderer.initialize();

const loader = new GLTFLoader();
await loader.load(new URL('../../../models/animated_cube/AnimatedCube.gltf', import.meta.url));

function loadAnimation(gltfSpec, scene) {
    if (loader.cache.has(gltfSpec)) {
        return loader.cache.get(gltfSpec);
    }

    if (gltfSpec.channels === undefined || gltfSpec.samplers === undefined) {
        return null;
    }

    for (const channel of gltfSpec.channels) {
        const keyframes = [];
        const values = [];

        const target = channel.target;
        if (target.node === undefined) {
            continue;
        }
        const entity = scene[target.node];
        const transform = entity.getComponentOfType(Transform);
        
        const sampler = gltfSpec.samplers[channel.sampler];
        const keyframeAccessor = loader.loadAccessor(sampler.input);
        const interpolation = sampler.interpolation ?? 'LINEAR';
        const valuesAccessor = loader.loadAccessor(sampler.output);

        for (let i = 0; i < keyframeAccessor.count; i++) {
            keyframes.push(...keyframeAccessor.get(i));
            values.push(valuesAccessor.get(i));
        }

        const animation = new Animation({
            transform,
            type: target.path,
            interpolation,
            keyframes,
            values,
            fps: 1
        });
        entity.addComponent(animation);
    }
}

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

for (const animation of loader.gltf.animations) {
    loadAnimation(animation, scene);
}

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