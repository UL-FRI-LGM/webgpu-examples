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
        -1, -1, -1,        0,  0,  0,  1,    //   0
        -1, -1,  1,        0,  0,  1,  1,    //   1
        -1,  1, -1,        0,  1,  0,  1,    //   2
        -1,  1,  1,        0,  1,  1,  1,    //   3
         1, -1, -1,        1,  0,  0,  1,    //   4
         1, -1,  1,        1,  0,  1,  1,    //   5
         1,  1, -1,        1,  1,  0,  1,    //   6
        1,  1,  1,       0.5,  0.5,  0.5,  1,    //   7
    ]),
});

const vertexBufferLayout = {
    arrayStride: 28,
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
            offset: 12,
            format: 'float32x4',
        },
    ],
};

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

function setTransformMatrix()
{
    mat4.identity(modelMatrix);

    var mTranslate = mat4.create();
    mat4.set(mTranslate,
        1,0,0,2,
        0,1,0,3,
        0,0,1,-10,
        0,0,0,1);
    mat4.multiply(modelMatrix, mTranslate, modelMatrix);

    var mRotate = mat4.create();
    var ang=45/180*3.14;
    mat4.set(mRotate,
        1,0,0,0,
        0, Math.cos(ang), Math.sin(ang), 0,
        0, -Math.sin(ang), Math.cos(ang), 0,
        0,0,0,1);
    mat4.multiply(modelMatrix, mRotate, modelMatrix);

    var mScale = mat4.create();
    mat4.set(mScale,
        0.5,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1);
    mat4.multiply(modelMatrix, mScale, modelMatrix);

    mat4.transpose(modelMatrix, modelMatrix);
}

function setTransformMatrix1(t)
{
    mat4.identity(modelMatrix);

    mat4.translate(modelMatrix, modelMatrix, [0,0,-8]);

    mat4.translate(modelMatrix, modelMatrix, [0,0,-10]);
    mat4.rotateY(modelMatrix, modelMatrix, -40/180*3.14);
    mat4.rotateZ(modelMatrix, modelMatrix, 45/180*3.14);
    //mat4.rotateY(modelMatrix, modelMatrix, t * 0.6);
    mat4.scale(modelMatrix, modelMatrix, [2,1,1]);

}

function setViewMatrix()
{
    mat4.identity(viewMatrix);
}

function update(t, dt) {

    //setTransformMatrix();
    setTransformMatrix(t);
    setViewMatrix()
}

function render() {
    const modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, modelViewProjectionMatrix, projectionMatrix);
    mat4.multiply(modelViewProjectionMatrix, modelViewProjectionMatrix, viewMatrix);
    mat4.multiply(modelViewProjectionMatrix, modelViewProjectionMatrix, modelMatrix);

    queue.writeBuffer(uniformBuffer, 0, modelViewProjectionMatrix);

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

    var fld=10
    //mat4.orthoZO(projectionMatrix,-fld,fld,-fld*height/width,fld*height/width,0.1,100);
    mat4.perspectiveZO(projectionMatrix, Math.PI / 3, width / height, 0.1, 100);
}

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();
