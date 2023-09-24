import { vec3, mat3, mat4 } from '../../../lib/gl-matrix-module.js';

import * as WebGPU from '../../../common/engine/WebGPU.js';

import { Light } from './Light.js';

import {
    getLocalModelMatrix,
    getGlobalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
    getModels,
} from '../../../common/engine/core/SceneUtils.js';

import {
    createVertexBuffer,
} from '../../../common/engine/core/VertexUtils.js';

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

const cameraBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const lightBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const modelBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
    ],
};

const materialBindGroupLayout = {
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: {},
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {},
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {},
        },
    ],
};

export async function initializeWebGPU(canvas) {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const queue = device.queue;
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    return { adapter, device, queue, context, format };
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

        this.perFragment = true;
    }

    async initialize() {
        Object.assign(this, await initializeWebGPU(this.canvas));

        const codePerFragment = await fetch('phongPerFragment.wgsl').then(response => response.text());
        const codePerVertex = await fetch('phongPerVertex.wgsl').then(response => response.text());

        const modulePerFragment = this.device.createShaderModule({ code: codePerFragment });
        const modulePerVertex = this.device.createShaderModule({ code: codePerVertex });

        this.cameraBindGroupLayout = this.device.createBindGroupLayout(cameraBindGroupLayout);
        this.lightBindGroupLayout = this.device.createBindGroupLayout(lightBindGroupLayout);
        this.modelBindGroupLayout = this.device.createBindGroupLayout(modelBindGroupLayout);
        this.materialBindGroupLayout = this.device.createBindGroupLayout(materialBindGroupLayout);

        const layout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                this.cameraBindGroupLayout,
                this.lightBindGroupLayout,
                this.modelBindGroupLayout,
                this.materialBindGroupLayout,
            ],
        });

        this.pipelinePerFragment = await this.device.createRenderPipelineAsync({
            vertex: {
                module: modulePerFragment,
                entryPoint: 'vertex',
                buffers: [ vertexBufferLayout ],
            },
            fragment: {
                module: modulePerFragment,
                entryPoint: 'fragment',
                targets: [{ format: this.format }],
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
            layout,
        });

        this.pipelinePerVertex = await this.device.createRenderPipelineAsync({
            vertex: {
                module: modulePerVertex,
                entryPoint: 'vertex',
                buffers: [ vertexBufferLayout ],
            },
            fragment: {
                module: modulePerVertex,
                entryPoint: 'fragment',
                targets: [{ format: this.format }],
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
            layout,
        });

        this.recreateDepthTexture();

        this.cameraUniformBuffer = this.device.createBuffer({
            size: 144,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.cameraBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.cameraUniformBuffer },
                },
            ],
        });

        this.lightUniformBuffer = this.device.createBuffer({
            size: 48,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.lightBindGroup = this.device.createBindGroup({
            layout: this.lightBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.lightUniformBuffer },
                },
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

    prepareNode(node) {
        if (this.gpuObjects.has(node)) {
            return this.gpuObjects.get(node);
        }

        for (const model of getModels(node)) {
            this.prepareModel(model);
        }
        for (const child of node.children) {
            this.prepareNode(child);
        }

        const modelUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const modelBindGroup = this.device.createBindGroup({
            layout: this.modelBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: modelUniformBuffer },
                },
            ],
        });

        this.gpuObjects.set(node, { modelUniformBuffer, modelBindGroup });
        return { modelUniformBuffer, modelBindGroup };
    }

    prepareModel(model) {
        for (const primitive of model.primitives) {
            this.preparePrimitive(primitive);
        }
    }

    preparePrimitive(primitive) {
        if (primitive.mesh) {
            this.prepareMesh(primitive.mesh);
        }
        if (primitive.material) {
            this.prepareMaterial(primitive.material);
        }
    }

    prepareMaterial(material) {
        if (this.gpuObjects.has(material)) {
            return this.gpuObjects.get(material);
        }

        if (material.baseTexture) {
            this.prepareTexture(material.baseTexture);
        }
        if (material.emissionTexture) {
            this.prepareTexture(material.emissionTexture);
        }
        if (material.normalTexture) {
            this.prepareTexture(material.normalTexture);
        }
        if (material.occlusionTexture) {
            this.prepareTexture(material.occlusionTexture);
        }
        if (material.roughnessTexture) {
            this.prepareTexture(material.roughnessTexture);
        }
        if (material.metalnessTexture) {
            this.prepareTexture(material.metalnessTexture);
        }

        const baseTexture = this.prepareImage(material.baseTexture.image);
        const baseSampler = this.prepareSampler(material.baseTexture.sampler);

        const materialUniformBuffer = this.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const materialBindGroup = this.device.createBindGroup({
            layout: this.materialBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: materialUniformBuffer },
                },
                {
                    binding: 1,
                    resource: baseTexture.createView(),
                },
                {
                    binding: 2,
                    resource: baseSampler,
                },
            ],
        });

        this.gpuObjects.set(material, { materialUniformBuffer, materialBindGroup });
        return { materialUniformBuffer, materialBindGroup };
    }

    prepareTexture(texture) {
        if (texture.image) {
            this.prepareImage(texture.image);
        }
        if (texture.sampler) {
            this.prepareSampler(texture.sampler);
        }
    }

    prepareImage(image) {
        if (this.gpuObjects.has(image)) {
            return this.gpuObjects.get(image);
        }

        const gpuTexture = WebGPU.createTexture(this.device, { source: image });

        this.gpuObjects.set(image, gpuTexture);
        return gpuTexture;
    }

    prepareSampler(sampler) {
        if (this.gpuObjects.has(sampler)) {
            return this.gpuObjects.get(sampler);
        }

        const gpuSampler = this.device.createSampler(sampler);

        this.gpuObjects.set(sampler, gpuSampler);
        return gpuSampler;
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

        this.gpuObjects.set(mesh, { vertexBuffer, indexBuffer });
        return { vertexBuffer, indexBuffer };
    }

    render(scene, camera, light) {
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
        renderPass.setPipeline(this.perFragment ? this.pipelinePerFragment : this.pipelinePerVertex);

        const viewMatrix = getGlobalViewMatrix(camera);
        const projectionMatrix = getProjectionMatrix(camera);
        const cameraPosition = mat4.getTranslation(vec3.create(), getGlobalModelMatrix(camera));

        this.queue.writeBuffer(this.cameraUniformBuffer, 0, viewMatrix);
        this.queue.writeBuffer(this.cameraUniformBuffer, 64, projectionMatrix);
        this.queue.writeBuffer(this.cameraUniformBuffer, 128, cameraPosition);

        renderPass.setBindGroup(0, this.cameraBindGroup);

        const lightComponent = light.getComponentOfType(Light);
        const lightColor = vec3.scale(vec3.create(), lightComponent.color, lightComponent.intensity / 255);
        const lightPosition = mat4.getTranslation(vec3.create(), getGlobalModelMatrix(light));
        const lightAttenuation = vec3.clone(lightComponent.attenuation);
        this.queue.writeBuffer(this.lightUniformBuffer, 0, lightColor);
        this.queue.writeBuffer(this.lightUniformBuffer, 16, lightPosition);
        this.queue.writeBuffer(this.lightUniformBuffer, 32, lightAttenuation);

        renderPass.setBindGroup(1, this.lightBindGroup);

        this.renderNode(renderPass, scene);

        renderPass.end();
        this.queue.submit([encoder.finish()]);
    }

    renderNode(renderPass, node, modelMatrix = mat4.create()) {
        const localMatrix = getLocalModelMatrix(node);
        modelMatrix = mat4.multiply(mat4.create(), modelMatrix, localMatrix);

        const { modelUniformBuffer, modelBindGroup } = this.prepareNode(node);
        const normalMatrix = createNormalMatrixFromModelMatrix(modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
        this.queue.writeBuffer(modelUniformBuffer, 64, normalMatrix);
        renderPass.setBindGroup(2, modelBindGroup);

        for (const model of getModels(node)) {
            this.renderModel(renderPass, model);
        }

        for (const child of node.children) {
            this.renderNode(renderPass, child, modelMatrix);
        }
    }

    renderModel(renderPass, model) {
        for (const primitive of model.primitives) {
            this.renderPrimitive(renderPass, primitive);
        }
    }

    renderPrimitive(renderPass, primitive) {
        const material = primitive.material;
        const { materialUniformBuffer, materialBindGroup } = this.prepareMaterial(material);
        this.queue.writeBuffer(materialUniformBuffer, 0, new Float32Array([
            material.diffuse,
            material.specular,
            material.shininess
        ]));
        renderPass.setBindGroup(3, materialBindGroup);

        const { vertexBuffer, indexBuffer } = this.prepareMesh(primitive.mesh);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, 'uint32');

        renderPass.drawIndexed(primitive.mesh.indices.length);
    }

}
