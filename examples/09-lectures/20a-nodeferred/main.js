import { mat4, quat, vec3 } from 'glm';
import * as WebGPU from 'engine/WebGPU.js';
import { ResizeSystem } from 'engine/systems/ResizeSystem.js';
import { UpdateSystem } from 'engine/systems/UpdateSystem.js';
import { OBJLoader } from 'engine/loaders/OBJLoader.js';
import {createVertexBuffer} from 'engine/core/VertexUtils.js';


const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

//region Region Vertex Buffers
const loader = new OBJLoader();
//const mesh = await loader.loadMesh('./sphere.obj');
const mesh = await loader.load( '../../../models/monkey/monkey.obj');

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

const modelVertexBufferArrayBuffer = createVertexBuffer(mesh.vertices, vertexBufferLayout);
const modelVertexBuffer = WebGPU.createBuffer(device, {
    data: modelVertexBufferArrayBuffer,
    usage: GPUBufferUsage.VERTEX,
});

const modelNumberOfIndices = mesh.indices.length;
const modelIndexBufferArrayBuffer = new Uint32Array(mesh.indices).buffer;
const modelIndexBuffer = WebGPU.createBuffer(device, {
    data: modelIndexBufferArrayBuffer,
    usage: GPUBufferUsage.INDEX,
});

export const floorVertexArray = new Float32Array([
    // float4 position, float4 color, float2 uv,
    6, -1.5, 2,    0, 1, 0,  0, 1,
    -6, -1.5, -6,  0, 1, 0,  1, 0,
    -6, -1.5, 2,   0, 1, 0,  1, 1,
    6, -1.5, -6,   0, 1, 0,  0, 0,
    -6, -1.5, -6,  0, 1, 0,  1, 0,
    6, -1.5, 2,    0, 1, 0,  0, 1,
]);
const floorVertexBuffer = device.createBuffer({
    size: floorVertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});
new Float32Array(floorVertexBuffer.getMappedRange()).set(floorVertexArray);
floorVertexBuffer.unmap();
//endregion

//region pass1 pipeline

const modelUniformBuffer = device.createBuffer({
    size: 3 * 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const vs1code = await fetch('vertex1.wgsl').then(response => response.text());
const fs1code = await fetch('fragment1.wgsl').then(response => response.text());

const bgl1Pass = device.createBindGroupLayout({
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform',
            },
        },
    ],
    label: 'bgl1Pass',
});

const pass1Pipeline = device.createRenderPipeline({
    vertex: {
        module: device.createShaderModule({
            code: vs1code,
        }),
        entryPoint: 'main',
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module: device.createShaderModule({
            code: fs1code,
        }),
        entryPoint: 'main',
        targets: [{ format: format, }], // was: format
    },
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
    },
    layout: device.createPipelineLayout({
        bindGroupLayouts: [bgl1Pass],
    }),
});


const bind1Group = device.createBindGroup({
    layout: bgl1Pass,
    entries: [
        {
            binding: 0,
            resource: { buffer: modelUniformBuffer },
        },
    ],
});

var depthTexture = device.createTexture({
    size: [1600, 1200],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});

// endregion


//region Region Transforms
const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();
var keys = {};
var rotQ=quat.create();
var transZ= -6;
var rotationMatrix = mat4.create();

initKeyHandlers();

function setTransformMatrix(t)
{
    mat4.identity(modelMatrix);
    mat4.translate(modelMatrix, modelMatrix, [0,0,transZ]);
    mat4.fromQuat(rotationMatrix,rotQ);
    mat4.multiply(modelMatrix,modelMatrix,rotationMatrix);
    mat4.scale(modelMatrix, modelMatrix, [1,1,1]);
}

function setViewMatrix()
{
    mat4.identity(viewMatrix);

    // inverse camera translation
    mat4.translate(viewMatrix, viewMatrix, [0,0,0]);
    mat4.rotateZ(viewMatrix, viewMatrix, 0*Math.PI/180);
    mat4.invert(viewMatrix, viewMatrix);

    // lookat (eye, center, up)
//    mat4.lookAt(viewMatrix, [-3,-2,4], [-3,-1,-4], [0,1,0]);
}


function update(t, dt) {

    handleInteractions();
    setTransformMatrix(t);
    setViewMatrix()
}
//endregion


//region Region Render

var lightViewMatrix = mat4.create(), lightProjectionMatrix = mat4.create(), lightViewProjMatrix = mat4.create();
const lightPosition = vec3.fromValues(5,5,10);
mat4.lookAt(lightViewMatrix, lightPosition, vec3.fromValues(0,0,0), vec3.fromValues(0,1,0));
mat4.ortho(lightProjectionMatrix, -10, 10, -10, 10, -8, 30);
mat4.multiply(lightViewProjMatrix, lightProjectionMatrix,lightViewMatrix );


function render() {
    const modelViewProjectionMatrix = mat4.create();
    const modelViewMatrix = mat4.create();
    const normalMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, modelViewMatrix);
    mat4.invert(normalMatrix, modelMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
    queue.writeBuffer(modelUniformBuffer, 64, modelViewProjectionMatrix);
    queue.writeBuffer(modelUniformBuffer, 128, normalMatrix);

    const encoder = device.createCommandEncoder();
    {
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: {r: 0.5, g: 0.5, b: 0.5, a: 1.0},
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });
        renderPass.setPipeline(pass1Pipeline);
        renderPass.setBindGroup(0, bind1Group);
        renderPass.setVertexBuffer(0, modelVertexBuffer);
        renderPass.setIndexBuffer(modelIndexBuffer, 'uint32');
        renderPass.drawIndexed(modelNumberOfIndices);

        renderPass.setVertexBuffer(0, floorVertexBuffer);
        renderPass.draw(6);
        renderPass.end();
    }

    queue.submit([encoder.finish()]);
}

//endregion

//region Region resize and key events
function resize({ displaySize: { width, height }}) {
    depthTexture.destroy();
    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    // gBufferTextureAlbedo.destroy();
    // gBufferTextureAlbedo = device.createTexture({
    //     size: [canvas.width, canvas.height],
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    //     format: 'bgra8unorm',
    // });

    var fld= 10;
    //mat4.orthoZO(projectionMatrix,-fld,fld,-fld*height/width,fld*height/width,0.1,100);
    mat4.perspectiveZO(projectionMatrix, Math.PI / 3, width / height, 1, 100);
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
//endregion