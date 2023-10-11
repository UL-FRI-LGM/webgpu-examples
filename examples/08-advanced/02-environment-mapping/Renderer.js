import { vec3, mat3, mat4 } from '../../../lib/gl-matrix-module.js';

import * as WebGPU from '../../../common/engine/WebGPU.js';

import {
    Camera,
    Model,
    Transform,
} from '../../../common/engine/core.js';

import {
    getLocalModelMatrix,
    getGlobalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
} from '../../../common/engine/core/SceneUtils.js';

import {
    createVertexBuffer,
} from '../../../common/engine/core/VertexUtils.js';

export async function initializeWebGPU(canvas) {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const queue = device.queue;
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    return { adapter, device, queue, context, format };
}

const vertexBufferLayout = {
    arrayStride: 48,
    attributes: [
        {
            name: 'position',
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
        },
        {
            name: 'texcoords',
            shaderLocation: 1,
            offset: 12,
            format: 'float32x2',
        },
        {
            name: 'normal',
            shaderLocation: 2,
            offset: 20,
            format: 'float32x3',
        },
        {
            name: 'tangent',
            shaderLocation: 3,
            offset: 32,
            format: 'float32x3',
        },
    ],
};

export async function createPipeline(device, format) {
    const code = await fetch('shader.wgsl').then(response => response.text());
    const module = device.createShaderModule({ code });
    const pipeline = await device.createRenderPipelineAsync({
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

    return pipeline;
}

function createNormalMatrixFromModelMatrix(modelMatrix) {
    const normalMatrixMat3 = mat3.normalFromMat4(mat3.create(), modelMatrix);
    const normalMatrix = mat4.create();
    normalMatrix[0] = normalMatrixMat3[0];
    normalMatrix[1] = normalMatrixMat3[1];
    normalMatrix[2] = normalMatrixMat3[2];
    normalMatrix[4] = normalMatrixMat3[3];
    normalMatrix[5] = normalMatrixMat3[4];
    normalMatrix[6] = normalMatrixMat3[5];
    normalMatrix[8] = normalMatrixMat3[6];
    normalMatrix[9] = normalMatrixMat3[7];
    normalMatrix[10] = normalMatrixMat3[8];
    return normalMatrix;
}

export class Renderer {

    constructor(canvas) {
        this.canvas = canvas;
        this.gpuObjects = new WeakMap();
    }

    async initialize() {
        Object.assign(this, await initializeWebGPU(this.canvas));
        this.pipeline = await createPipeline(this.device, this.format);
        this.recreateDepthTexture();
    }

    setEnvironment(images) {
        this.environmentTexture?.destroy();
        this.environmentTexture = this.device.createTexture({
            size: [images[0].width, images[0].height, 6],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        for (let i = 0; i < images.length; i++) {
            this.queue.copyExternalImageToTexture(
                { source: images[i] },
                { texture: this.environmentTexture, origin: [0, 0, i] },
                [images[i].width, images[i].height],
            );
        }

        this.environmentSampler = this.device.createSampler({
            minFilter: 'linear',
            magFilter: 'linear',
        });

        this.environmentBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(3),
            entries: [
                { binding: 0, resource: this.environmentTexture.createView({ dimension: 'cube' }) },
                { binding: 1, resource: this.environmentSampler },
            ],
        });
    }

    recreateDepthTexture() {
        this.depthTexture?.destroy();

        this.depthTexture = this.device.createTexture({
            format: 'depth24plus',
            size: [this.canvas.width, this.canvas.height],
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    prepareCamera(camera) {
        if (this.gpuObjects.has(camera)) {
            return this.gpuObjects.get(camera);
        }

        const cameraUniformBuffer = this.device.createBuffer({
            size: 144,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const cameraBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: cameraUniformBuffer } }
            ],
        });

        const gpuObjects = {
            cameraUniformBuffer,
            cameraBindGroup,
        };

        this.gpuObjects.set(camera, gpuObjects);
        return gpuObjects;
    }

    prepareMesh(mesh) {
        if (this.gpuObjects.has(mesh)) {
            return this.gpuObjects.get(mesh);
        }

        const vertexBufferArrayBuffer = createVertexBuffer(mesh.vertices, vertexBufferLayout);
        const vertexBuffer = WebGPU.createBuffer(this.device, {
            data: vertexBufferArrayBuffer,
            usage: GPUBufferUsage.VERTEX,
        });

        const indexBufferArrayBuffer = new Uint32Array(mesh.indices).buffer;
        const indexBuffer = WebGPU.createBuffer(this.device, {
            data: indexBufferArrayBuffer,
            usage: GPUBufferUsage.INDEX,
        });

        const gpuObjects = {
            vertexBuffer,
            indexBuffer,
        };

        this.gpuObjects.set(mesh, gpuObjects);
        return gpuObjects;
    }

    prepareModel(model) {
        if (this.gpuObjects.has(model)) {
            return this.gpuObjects.get(model);
        }

        const modelUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const modelBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                { binding: 0, resource: { buffer: modelUniformBuffer } },
            ],
        });

        const gpuObjects = {
            modelUniformBuffer,
            modelBindGroup,
        };

        this.gpuObjects.set(model, gpuObjects);
        return gpuObjects;
    }

    prepareTexture(texture) {
        if (this.gpuObjects.has(texture)) {
            return this.gpuObjects.get(texture);
        }

        const gpuTexture = WebGPU.createTexture(this.device, { source: texture.image });
        const sampler = this.device.createSampler(texture.sampler);

        const gpuObjects = {
            texture: gpuTexture,
            sampler,
        };

        this.gpuObjects.set(texture, gpuObjects);
        return gpuObjects;
    }

    prepareMaterial(material) {
        if (this.gpuObjects.has(material)) {
            return this.gpuObjects.get(material);
        }

        const base = this.prepareTexture(material.baseTexture);

        const materialUniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const materialBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: materialUniformBuffer } },
                { binding: 1, resource: base.texture.createView() },
                { binding: 2, resource: base.sampler },
            ],
        });

        const gpuObjects = {
            materialUniformBuffer,
            materialBindGroup,
        };

        this.gpuObjects.set(material, gpuObjects);
        return gpuObjects;
    }

    render(scene, camera) {
        if (this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height) {
            this.recreateDepthTexture();
        }

        const encoder = this.device.createCommandEncoder();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.context.getCurrentTexture().createView(),
                    clearValue: [1, 1, 1, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                }
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard',
            },
        });
        renderPass.setPipeline(this.pipeline);

        // setup camera
        const cameraCamera = camera.getComponentOfType(Camera);
        const { cameraUniformBuffer, cameraBindGroup } = this.prepareCamera(cameraCamera);

        const viewMatrix = getGlobalViewMatrix(camera);
        const projectionMatrix = getProjectionMatrix(camera);
        const cameraPosition = mat4.getTranslation(vec3.create(), getGlobalModelMatrix(camera));

        this.queue.writeBuffer(cameraUniformBuffer, 0, viewMatrix);
        this.queue.writeBuffer(cameraUniformBuffer, 64, projectionMatrix);
        this.queue.writeBuffer(cameraUniformBuffer, 128, cameraPosition);

        renderPass.setBindGroup(0, cameraBindGroup);

        // setup environment
        renderPass.setBindGroup(3, this.environmentBindGroup);

        this.renderNode(renderPass, scene);

        renderPass.end();
        this.queue.submit([encoder.finish()]);
    }

    renderNode(renderPass, node, modelMatrix = mat4.create()) {
        const localMatrix = getLocalModelMatrix(node);
        modelMatrix = mat4.multiply(mat4.create(), modelMatrix, localMatrix);

        for (const model of node.getComponentsOfType(Model)) {
            this.renderModel(renderPass, model, modelMatrix);
        }

        for (const child of node.children) {
            this.renderNode(renderPass, child, modelMatrix);
        }
    }

    renderModel(renderPass, model, modelMatrix) {
        for (const primitive of model.primitives) {
            this.renderPrimitive(renderPass, primitive, modelMatrix);
        }
    }

    renderPrimitive(renderPass, primitive, modelMatrix) {
        // set model uniforms
        const { modelUniformBuffer, modelBindGroup } = this.prepareModel(primitive);
        const normalMatrix = createNormalMatrixFromModelMatrix(modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 64, normalMatrix);
        renderPass.setBindGroup(1, modelBindGroup);

        // set material
        const { materialUniformBuffer, materialBindGroup } = this.prepareMaterial(primitive.material);
        this.queue.writeBuffer(materialUniformBuffer, 0, new Float32Array([
            primitive.material.reflectance,
            primitive.material.transmittance,
            primitive.material.ior,
            primitive.material.effect
        ]));
        renderPass.setBindGroup(2, materialBindGroup);

        // set mesh vertex and index buffers
        if (!this.gpuObjects.has(primitive.mesh)) {
            this.prepareMesh(primitive.mesh);
        }
        const { vertexBuffer, indexBuffer } = this.gpuObjects.get(primitive.mesh);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint32');

        // draw the primitive
        renderPass.drawIndexed(primitive.mesh.indices.length);
    }

}
