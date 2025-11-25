import { mat4, quat } from 'glm';
import * as WebGPU from 'engine/WebGPU.js';
import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';
import { OBJLoader } from 'engine/loaders/OBJLoader.js';
import {createVertexBuffer} from 'engine/core/VertexUtils.js';
import { ImageLoader } from 'engine/loaders/ImageLoader.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const loader = new OBJLoader();
//const mesh = await loader.loadMesh('./sphere.obj');
const mesh = await loader.load( '../../../models/monkey/monkey.obj');

export const cubeVertexArray = new Float32Array([
    // float4 position
    1, -1, 1, 1,
    -1, -1, 1, 1,
    -1, -1, -1, 1,
    1, -1, -1, 1,
    1, -1, 1, 1,
    -1, -1, -1, 1,

    1, 1, 1, 1,
    1, -1, 1, 1,
    1, -1, -1, 1,
    1, 1, -1, 1,
    1, 1, 1, 1,
    1, -1, -1, 1,

    -1, 1, 1, 1,
    1, 1, 1, 1,
    1, 1, -1, 1,
    -1, 1, -1, 1,
    -1, 1, 1, 1,
    1, 1, -1, 1,

    -1, -1, 1, 1,
    -1, 1, 1, 1,
    -1, 1, -1, 1,
    -1, -1, -1, 1,
    -1, -1, 1, 1,
    -1, 1, -1, 1,

    1, 1, 1, 1,
    -1, 1, 1, 1,
    -1, -1, 1, 1,
    -1, -1, 1, 1,
    1, -1, 1, 1,
    1, 1, 1, 1,

    1, -1, -1, 1,
    -1, -1, -1, 1,
    -1, 1, -1, 1,
    1, 1, -1, 1,
    1, -1, -1, 1,
    -1, 1, -1, 1,
]);

const geoVertexBufferLayout = {
    arrayStride: 32,
    attributes: [
        {
            name: 'position',
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
        },
        {
            name: 'normal',
            shaderLocation: 1,
            offset: 12,
            format: 'float32x3',
        },
        {
            name: 'texcoords',
            shaderLocation: 2,
            offset: 24,
            format: 'float32x2',
        },

    ],
};

const geoVertexBufferArrayBuffer = createVertexBuffer(mesh.vertices, geoVertexBufferLayout);
const geoVertexBuffer = WebGPU.createBuffer(device, {
    data: geoVertexBufferArrayBuffer,
    usage: GPUBufferUsage.VERTEX,
});

const numberOfIndices = mesh.indices.length;
const indexBufferArrayBuffer = new Uint32Array(mesh.indices).buffer;
const geoIndexBuffer = WebGPU.createBuffer(device, {
    data: indexBufferArrayBuffer,
    usage: GPUBufferUsage.INDEX,
});

const cubeVertexBufferLayout = {
    arrayStride: 16,
    attributes: [
        {
            name: 'position',
            shaderLocation: 0,
            offset: 0,
            format: 'float32x4',
        },
    ],
};
const cubeVertexBuffer = device.createBuffer({
    size: cubeVertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});
new Float32Array(cubeVertexBuffer.getMappedRange()).set(cubeVertexArray);
cubeVertexBuffer.unmap();

const geoCode = await fetch('shaderGeo.wgsl').then(response => response.text());
const geoModule = device.createShaderModule({ code: geoCode });
const geoPipeline = device.createRenderPipeline({
    vertex: {
        module: geoModule,
        entryPoint: 'vertex',
        buffers: [ geoVertexBufferLayout ],
    },
    fragment: {
        module: geoModule,
        entryPoint: 'fragment',
        targets: [{ format }],
    },
    depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
    },
    layout: 'auto',
});


const cubeCode = await fetch('shaderCube.wgsl').then(response => response.text());
const cubeModule = device.createShaderModule({ code: cubeCode });
const cubePipeline = device.createRenderPipeline({
    vertex: {
        module: cubeModule,
        entryPoint: 'vertex',
        buffers: [ cubeVertexBufferLayout ],
    },
    fragment: {
        module: cubeModule,
        entryPoint: 'fragment',
        targets: [{ format }],
    },
    depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false, // don't write to the depth buffer
    },
    layout: 'auto',
});


const uniformBuffer = device.createBuffer({
    size: 192,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

let depthTexture = device.createTexture({
    format: 'depth24plus',
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const imageLoader = new ImageLoader();
const environmentImages = await Promise.all([
    'posx.jpg',
    'negx.jpg',
    'posy.jpg',
    'negy.jpg',
    'posz.jpg',
    'negz.jpg',
].map(url => imageLoader.load(url)));

let environmentTexture = device.createTexture({
    size: [environmentImages[0].width, environmentImages[0].height, 6],
    format: 'rgba8unorm',
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
});

for (let i = 0; i < environmentImages.length; i++) {
    device.queue.copyExternalImageToTexture(
        { source: environmentImages[i] },
        { texture: environmentTexture, origin: [0, 0, i] },
        [environmentImages[i].width, environmentImages[i].height],
    );
}
let environmentSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
});


const cubeBindGroup = device.createBindGroup({
    layout: cubePipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer },},
        { binding: 1, resource: environmentTexture.createView({ dimension: 'cube' }) },
        { binding: 2, resource: environmentSampler },
    ],
});

const geoBindGroup = device.createBindGroup({
    layout: geoPipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer },},
    ],
});

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();
var keys = {};
var rotQ=quat.create();
var transZ= 0;
var rotationMatrix = mat4.create();

initKeyHandlers();

function setTransformMatrix(t)
{
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, [0,0,-8]);
    // mat4.fromQuat(rotationMatrix,rotQ);
    // mat4.multiply(modelMatrix,modelMatrix,rotationMatrix);
    // mat4.scale(modelMatrix, modelMatrix, [1,1,1]);
}

function setViewMatrix()
{
    mat4.identity(viewMatrix);

    // inverse camera translation
     mat4.translate(viewMatrix, viewMatrix, [0,0,transZ]);
     mat4.fromQuat(rotationMatrix,rotQ);
     mat4.multiply(viewMatrix,viewMatrix,rotationMatrix);
     mat4.invert(viewMatrix, viewMatrix);

    // lookat (eye, center, up)
//    mat4.lookAt(viewMatrix, [-3,-2,4], [-3,-1,-4], [0,1,0]);
}


function update(t, dt) {

    handleInteractions();
    setTransformMatrix(t);
    setViewMatrix()
}

function render() {
    const modelViewMatrix = mat4.create();
    const normalMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    queue.writeBuffer(uniformBuffer, 0, modelViewMatrix);
    queue.writeBuffer(uniformBuffer, 64, projectionMatrix);
    queue.writeBuffer(uniformBuffer, 128, normalMatrix);

    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store',
            }
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        },
    });
    renderPass.setPipeline(cubePipeline);
    renderPass.setBindGroup(0, cubeBindGroup);
    renderPass.setVertexBuffer(0, cubeVertexBuffer);
    renderPass.draw(36);

    renderPass.setPipeline(geoPipeline);
    renderPass.setBindGroup(0, geoBindGroup);
    renderPass.setVertexBuffer(0, geoVertexBuffer);
    renderPass.setIndexBuffer(geoIndexBuffer, 'uint32');
    renderPass.drawIndexed(numberOfIndices);

    renderPass.end();
    queue.submit([encoder.finish()]);
}

function resize({ displaySize: { width, height }}) {
    depthTexture.destroy();
    depthTexture = device.createTexture({
        format: 'depth24plus',
        size: [canvas.width, canvas.height],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    var fld= 10;
    //mat4.orthoZO(projectionMatrix,-fld,fld,-fld*height/width,fld*height/width,0.1,100);
    mat4.perspectiveZO(projectionMatrix, Math.PI / 3, width / height, 0.1, 100);
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();

function initKeyHandlers() {

    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
}

function handleKeyDown(event) {
    // storing the pressed state for individual key
    keys[event.code] = true;
}

function handleKeyUp(event) {
    // reseting the pressed state for individual key
    keys[event.code] = false;
}

function handleInteractions() {
    if (keys['KeyQ']) {
        quat.rotateX(rotQ,rotQ,-1*Math.PI/180)
        keys['KeyQ'] = false;
    }
    if (keys['KeyW']) {
        quat.rotateX(rotQ,rotQ,1*Math.PI/180)
        keys['KeyW'] = false;
    }
    if (keys['KeyA']) {
        quat.rotateY(rotQ,rotQ,-1*Math.PI/180)
        keys['KeyA'] = false
    }
    if (keys['KeyS']) {
        quat.rotateY(rotQ,rotQ,1*Math.PI/180)
        keys['KeyS'] = false
    }
    if (keys['KeyZ']) {
        quat.rotateZ(rotQ,rotQ,-1*Math.PI/180)
        keys['KeyZ'] = false
    }
    if (keys['KeyX']) {
        quat.rotateZ(rotQ,rotQ,1*Math.PI/180)
        keys['KeyX'] = false
    }
    if (keys['KeyE']) {
        transZ+=0.1;
        keys['KeyE'] = false
    }
    if (keys['KeyD']) {
        transZ-=0.1;
        keys['KeyD'] = false
    }
}
