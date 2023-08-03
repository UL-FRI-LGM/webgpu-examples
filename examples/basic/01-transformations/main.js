import { mat4 } from '../../../lib/gl-matrix-module.js';

import { ResizeSystem } from '../../../common/engine/systems/ResizeSystem.js';
import { UpdateSystem } from '../../../common/engine/systems/UpdateSystem.js';

import { createTextureFromSource } from '../../../common/engine/webgpu/TextureUtils.js';
import { createBufferFromArrayBuffer } from '../../../common/engine/webgpu/BufferUtils.js';
import { createArrayBufferFromLayout } from '../../../common/engine/core/ArrayUtils.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const vertexBufferLayout = {
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
        },
        {
            shaderLocation: 1,
            offset: 12,
            format: 'float32x2',
        },
    ],
    arrayStride: 20,
};

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        entryPoint: 'vertex',
        buffers: [ vertexBufferLayout ],
    },
    fragment: {
        module,
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

const model = await fetch('../../../common/models/lamp.json').then(response => response.json());

const vertices = createArrayBufferFromLayout(model, {
    positions: {
        view: Float32Array,
        components: 3,
        stride: 20,
        offset: 0,
    },
    texcoords: {
        view: Float32Array,
        components: 2,
        stride: 20,
        offset: 12,
    },
});
const vertexBuffer = createBufferFromArrayBuffer(device, {
    source: vertices,
    usage: GPUBufferUsage.VERTEX,
});

const numberOfIndices = model.indices.length;
const indices = createArrayBufferFromLayout(model, {
    indices: {
        view: Uint32Array,
        components: 1,
        stride: 4,
        offset: 0,
    },
});
const indexBuffer = createBufferFromArrayBuffer(device, {
    source: indices,
    usage: GPUBufferUsage.INDEX,
});

const uniformBuffer = device.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const imageBitmap = await fetch('../../../common/images/lamp.webp')
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob));
const texture = createTextureFromSource(device, {
    source: imageBitmap,
});

let depthTexture = device.createTexture({
    format: 'depth24plus',
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
});

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {
            binding: 0,
            resource: { buffer: uniformBuffer },
        },
        {
            binding: 1,
            resource: texture.createView(),
        },
        {
            binding: 2,
            resource: sampler,
        },
    ],
});

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();

function update(t, dt) {
    mat4.identity(modelMatrix);
    mat4.rotateX(modelMatrix, modelMatrix, t * 0.5);
    mat4.rotateY(modelMatrix, modelMatrix, t * 0.6);

    mat4.fromTranslation(viewMatrix, [0, 0, 1]);
    mat4.invert(viewMatrix, viewMatrix);
}

function render() {
    const projectionViewModelMatrix = mat4.create();
    mat4.multiply(projectionViewModelMatrix, projectionViewModelMatrix, projectionMatrix);
    mat4.multiply(projectionViewModelMatrix, projectionViewModelMatrix, viewMatrix);
    mat4.multiply(projectionViewModelMatrix, projectionViewModelMatrix, modelMatrix);

    queue.writeBuffer(uniformBuffer, 0, modelMatrix);
    queue.writeBuffer(uniformBuffer, 64, viewMatrix);
    queue.writeBuffer(uniformBuffer, 128, projectionMatrix);
    queue.writeBuffer(uniformBuffer, 192, projectionViewModelMatrix);

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
            depthStoreOp: 'discard',
        },
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
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

    mat4.perspectiveZO(projectionMatrix, Math.PI / 3, width / height, 0.1, 100);
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
