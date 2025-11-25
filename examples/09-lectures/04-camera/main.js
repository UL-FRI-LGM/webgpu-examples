import { mat4, quat } from 'glm';
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
        -1, -1, -1,       0,  0,  0,  1,    //   0
        -1, -1,  1,       0,  0,  1,  1,    //   1
        -1,  1, -1,       0,  1,  0,  1,    //   2
        -1,  1,  1,       0,  1,  1,  1,    //   3
         1, -1, -1,       1,  0,  0,  1,    //   4
         1, -1,  1,       1,  0,  1,  1,    //   5
         1,  1, -1,       1,  1,  0,  1,    //   6
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
var keys = {};
var rotQ=quat.create();
var rotationMatrix = mat4.create();

initKeyHandlers();

function setTransformMatrix(t)
{
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, [0,0,-8]);
    mat4.fromQuat(rotationMatrix,rotQ);
    mat4.multiply(modelMatrix,modelMatrix,rotationMatrix);
    mat4.scale(modelMatrix, modelMatrix, [3,1,1]);
}

function setViewMatrix(t)
{
    mat4.identity(viewMatrix);

    // inverse camera translation
    // mat4.rotateZ(viewMatrix, viewMatrix, -40*Math.PI/180);
    // mat4.translate(viewMatrix, viewMatrix, [0,0,-2]);

    // lookat (eye, center, up)
    mat4.lookAt(viewMatrix, [0,3,10], [0,0,-10], [1,1,0]);
}


function update(t, dt) {

    handleInteractions();
    setTransformMatrix(t);
    setViewMatrix(t)
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

    var fld= 10;
    mat4.orthoZO(projectionMatrix,-fld,fld,-fld*height/width,fld*height/width,0.1,100);

    mat4.perspectiveZO(projectionMatrix, 45/180*Math.PI, width / height, 0.1, 100);
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
        quat.rotateX(rotQ,rotQ,-30*Math.PI/180)
        keys['KeyQ'] = false;
    }
    if (keys['KeyW']) {
        quat.rotateX(rotQ,rotQ,30*Math.PI/180)
        keys['KeyW'] = false;
    }
    if (keys['KeyA']) {
        quat.rotateY(rotQ,rotQ,-30*Math.PI/180)
        keys['KeyA'] = false
    }
    if (keys['KeyS']) {
        quat.rotateY(rotQ,rotQ,30*Math.PI/180)
        keys['KeyS'] = false
    }
    if (keys['KeyZ']) {
        quat.rotateZ(rotQ,rotQ,-30*Math.PI/180)
        keys['KeyZ'] = false
    }
    if (keys['KeyX']) {
        quat.rotateZ(rotQ,rotQ,30*Math.PI/180)
        keys['KeyX'] = false
    }
}
