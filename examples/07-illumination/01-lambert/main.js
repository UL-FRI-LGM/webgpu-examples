import { GUI } from 'dat';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

import { ImageLoader } from 'engine/loaders/ImageLoader.js';
import { JSONLoader } from 'engine/loaders/JSONLoader.js';

import { TouchController } from 'engine/controllers/TouchController.js';

import {
    Camera,
    Material,
    Model,
    Node,
    Primitive,
    Sampler,
    Texture,
    Transform,
} from 'engine/core.js';

import { Renderer } from './Renderer.js';
import { Light } from './Light.js';

const canvas = document.querySelector('canvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const scene = new Node();

const camera = new Node();
camera.addComponent(new Transform());
camera.addComponent(new Camera());
camera.addComponent(new TouchController(camera, canvas, { distance: 3 }));
scene.addChild(camera);

const light = new Node();
light.addComponent(new Light({
    direction: [-1, 1, 1],
}));
scene.addChild(light);

const model = new Node();
model.addComponent(new Model({
    primitives: [
        new Primitive({
            mesh: await new JSONLoader().loadMesh('../../../models/monkey/monkey.json'),
            material: new Material({
                baseTexture: new Texture({
                    image: await new ImageLoader().load('../../../models/monkey/base.png'),
                    sampler: new Sampler({
                        minFilter: 'nearest',
                        magFilter: 'nearest',
                    }),
                    isSRGB: true,
                }),
            }),
        }),
    ],
}));
scene.addChild(model);

function update(time, dt) {
    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(time, dt);
        }
    });
}

function render() {
    renderer.render(scene, camera, light);
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
lightFolder.addColor(lightSettings, 'color');

const lightDirection = lightFolder.addFolder('Direction');
lightDirection.open();
lightDirection.add(lightSettings.direction, 0, -1, 1).name('x');
lightDirection.add(lightSettings.direction, 1, -1, 1).name('y');
lightDirection.add(lightSettings.direction, 2, -1, 1).name('z');
