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
        //  positions     normal    uv           index
        -1, -1, -1,  1,   0,0,1,   0,  0,     //   0
        1,  -1, -1,  1,   0,0,1,   1,  0,     //   2
        -1,  1,  -1,  1,  0,0,1,   0,  1,   //   3
        1,  1,  -1,  1,   0,0,1,   1,  1,   //   3
    ]),
});

const numberOfIndices = 6;
const indexBuffer = WebGPU.createBuffer(device, {
    usage: GPUBufferUsage.INDEX,
    data: new Uint32Array([
        0, 1, 2,
        2, 1, 3
    ]),
});

const vertexBufferLayout = {
    arrayStride: 36,
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
            offset: 16,
            format: 'float32x3',
        },
        {
            name: 'uv',
            shaderLocation: 2,
            offset: 28,
            format: 'float32x2',
        },
    ],
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

const uniformBuffer = device.createBuffer({
    size: 192,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

let depthTexture = device.createTexture({
    format: 'depth24plus',
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});


const blob = await fetch('cobblestone_floor_08_diff_2k.jpg').then(response => response.blob());
const image = await createImageBitmap(blob);

const blob1 = await fetch('cobblestone_floor_08_nor_gl_2k.png').then(response => response.blob());
const image1 = await createImageBitmap(blob1);

const texture = device.createTexture({
    size: [image.width, image.height],
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
});

queue.copyExternalImageToTexture(
    { source: image },
    { texture: texture },
    [image.width, image.height]
);

const texture1 = device.createTexture({
    size: [image1.width, image1.height],
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm',
});

queue.copyExternalImageToTexture(
    { source: image1 },
    { texture: texture1 },
    [image1.width, image1.height]
);

const sampler = device.createSampler({
    magFilter: 'linear', // nearest, linear
    minFilter: 'linear', // nearest, linear
    addressModeU: "clamp-to-edge", // repeat, mirror-repeat
    addressModeV: "clamp-to-edge", // repeat, mirror-repeat
});

const sampler1 = device.createSampler({
    magFilter: 'linear', // nearest, linear
    minFilter: 'linear', // nearest, linear
    addressModeU: "clamp-to-edge", // repeat, mirror-repeat
    addressModeV: "clamp-to-edge", // repeat, mirror-repeat
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
        {
            binding: 3,
            resource: texture1.createView(),
        },
        {
            binding: 4,
            resource: sampler1,
        },
    ],
});

const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();
var keys = {};
var rotQ=quat.create();
quat.rotateX(rotQ,rotQ,-70*Math.PI/180)
var rotationMatrix = mat4.create();

initKeyHandlers();

function setTransformMatrix(t)
{
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, [0,0,-10]);
    mat4.fromQuat(rotationMatrix,rotQ);
    mat4.multiply(modelMatrix,modelMatrix,rotationMatrix);
    mat4.scale(modelMatrix, modelMatrix, [2,2,1]);
}

function setViewMatrix()
{
    mat4.identity(viewMatrix);

    // inverse camera translation
     mat4.translate(viewMatrix, viewMatrix, [0,0,-5]);
    //  mat4.rotateZ(viewMatrix, viewMatrix, 20*Math.PI/180);
     mat4.invert(viewMatrix, viewMatrix);

    // lookat (eye, center, up)
    //mat4.lookAt(viewMatrix, [-3,-2,4], [-3,-1,-4], [0,1,0]);
}


function update(t, dt) {

    handleInteractions();
    setTransformMatrix(t);
    setViewMatrix()
}

function render() {
    const modelViewProjectionMatrix = mat4.create();
    const modelViewMatrix = mat4.create();
    const normalMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, modelViewMatrix);
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    queue.writeBuffer(uniformBuffer, 0, modelViewMatrix);
    queue.writeBuffer(uniformBuffer, 64, modelViewProjectionMatrix);
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
}
