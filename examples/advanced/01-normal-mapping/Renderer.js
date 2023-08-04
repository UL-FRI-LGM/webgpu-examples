import { mat3, mat4 } from '../../../lib/gl-matrix-module.js';

import {
    Camera,
    Model,
    Transform,
} from '../../../common/engine/core.js';

import {
    getLocalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
} from '../../../common/engine/core/SceneUtils.js';

import {
    createVertexBuffer,
} from '../../../common/engine/core/VertexUtils.js';

import {
    createTextureFromSource,
    createBufferFromArrayBuffer,
} from '../../../common/engine/webgpu.js';

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

        this.cameraUniformBuffer = this.device.createBuffer({
            size: 144,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.cameraUniformBuffer },
                }
            ],
        });
    }

    recreateDepthTexture() {
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.depthTexture = this.device.createTexture({
            format: 'depth24plus',
            size: [this.canvas.width, this.canvas.height],
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    prepareMesh(mesh) {
        const vertexBufferArrayBuffer = createVertexBuffer(mesh.vertices, vertexBufferLayout);
        const vertexBuffer = createBufferFromArrayBuffer(this.device, {
            source: vertexBufferArrayBuffer,
            usage: GPUBufferUsage.VERTEX,
        });

        const indexBufferArrayBuffer = new Uint32Array(mesh.indices).buffer;
        const indexBuffer = createBufferFromArrayBuffer(this.device, {
            source: indexBufferArrayBuffer,
            usage: GPUBufferUsage.INDEX,
        });

        this.gpuObjects.set(mesh, { vertexBuffer, indexBuffer });
    }

    prepareModel(model) {
        const modelUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const modelBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: modelUniformBuffer },
                },
            ],
        });
        this.gpuObjects.set(model, { modelUniformBuffer, modelBindGroup });
    }

    prepareTexture(texture) {
        this.gpuObjects.set(texture, {
            texture: createTextureFromSource(this.device, { source: texture.image }),
            sampler: this.device.createSampler(texture.sampler),
        });
    }

    prepareMaterial(material) {
        this.prepareTexture(material.baseTexture);
        this.prepareTexture(material.normalTexture);

        const base = this.gpuObjects.get(material.baseTexture);
        const normal = this.gpuObjects.get(material.normalTexture);

        const materialBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(2),
            entries: [
                {
                    binding: 0,
                    resource: base.texture.createView(),
                },
                {
                    binding: 1,
                    resource: base.sampler,
                },
                {
                    binding: 2,
                    resource: normal.texture.createView(),
                },
                {
                    binding: 3,
                    resource: normal.sampler,
                },
            ],
        });

        this.gpuObjects.set(material, materialBindGroup);
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

        const viewMatrix = getGlobalViewMatrix(camera);
        const projectionMatrix = getProjectionMatrix(camera);

        this.queue.writeBuffer(this.cameraUniformBuffer, 0, viewMatrix);
        this.queue.writeBuffer(this.cameraUniformBuffer, 64, projectionMatrix);
        this.queue.writeBuffer(this.cameraUniformBuffer, 128, new Float32Array([performance.now() / 1000]));

        renderPass.setBindGroup(0, this.cameraBindGroup);

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
        if (!this.gpuObjects.has(primitive)) {
            this.prepareModel(primitive);
        }
        const { modelUniformBuffer, modelBindGroup } = this.gpuObjects.get(primitive);
        const normalMatrix = createNormalMatrixFromModelMatrix(modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 64, normalMatrix);
        renderPass.setBindGroup(1, modelBindGroup);

        // set material
        if (!this.gpuObjects.has(primitive.material)) {
            this.prepareMaterial(primitive.material);
        }
        const materialBindGroup = this.gpuObjects.get(primitive.material);
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
