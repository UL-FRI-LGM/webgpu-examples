import { mat4 } from 'glm';

import * as WebGPU from 'engine/WebGPU.js';

import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const vertexBuffer = WebGPU.createBuffer(device, {
    usage: GPUBufferUsage.VERTEX,
    data: new Float32Array([
        //  positions            colors           index
        -1, -1, -1,  1,      0,  0,  0,  1,    //   0
        -1, -1,  1,  1,      0,  0,  1,  1,    //   1
        -1,  1, -1,  1,      0,  1,  0,  1,    //   2
        -1,  1,  1,  1,      0,  1,  1,  1,    //   3
         1, -1, -1,  1,      1,  0,  0,  1,    //   4
         1, -1,  1,  1,      1,  0,  1,  1,    //   5
         1,  1, -1,  1,      1,  1,  0,  1,    //   6
         1,  1,  1,  1,      1,  1,  1,  1,    //   7
    ]),
});

const numberOfIndices = 36;
const indexBuffer = WebGPU.createBuffer(device, {
    usage: GPUBufferUsage.INDEX,
    data: new Uint32Array([
        0, 1, 2,    2, 1, 3,
        4, 0, 6,    6, 0, 2,
        5, 4, 7,    7, 4, 6,
        1, 5, 3,    3, 5, 7,
        6, 2, 7,    7, 2, 3,
        1, 0, 5,    5, 0, 4,
    ]),
});

const vertexBufferLayout = {
    arrayStride: 32,
    attributes: [
        {
            name: 'position',
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
        },
        {
            name: 'color',
            shaderLocation: 1,
            offset: 16,
            format: 'float32x4',
        },
    ],
};

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        buffers: [ vertexBufferLayout ],
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
    },
    layout: 'auto',
});

const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

let depthTexture = device.createTexture({
    format: 'depth24plus',
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        {
            binding: 0,
            resource: { buffer: uniformBuffer },
        },
    ],
});

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();

function update(t, dt) {
    modelMatrix
        .identity()
        .rotateX(t * 0.5)
        .rotateY(t * 0.6);

    viewMatrix
        .identity()
        .translate([0, 0, 5])
        .invert();
}

function render() {
    const matrix = mat4.create()
        .multiply(projectionMatrix)
        .multiply(viewMatrix)
        .multiply(modelMatrix);

    queue.writeBuffer(uniformBuffer, 0, matrix);

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

    projectionMatrix.perspectiveZO(Math.PI / 3, width / height, 0.1, 100);
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
