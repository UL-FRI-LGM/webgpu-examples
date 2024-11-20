import { vec3, mat4 } from 'glm';

import * as WebGPU from 'engine/WebGPU.js';

import { Camera, Model } from 'engine/core.js';
import { BaseRenderer } from 'engine/renderers/BaseRenderer.js';

import {
    getLocalModelMatrix,
    getGlobalModelMatrix,
    getGlobalViewMatrix,
    getProjectionMatrix,
} from 'engine/core/SceneUtils.js';

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
    ],
};

export class Renderer extends BaseRenderer {

    constructor(canvas) {
        super(canvas);
    }

    async initialize() {
        await super.initialize();

        const code = await fetch('shader.wgsl').then(response => response.text());
        const module = this.device.createShaderModule({ code });

        this.pipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module,
                buffers: [ vertexBufferLayout ],
            },
            fragment: {
                module,
                targets: [{ format: this.format }],
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
        });

        const skyboxCode = await fetch('skybox.wgsl').then(response => response.text());
        const skyboxModule = this.device.createShaderModule({ code: skyboxCode });

        this.skyboxPipeline = await this.device.createRenderPipelineAsync({
            layout: 'auto',
            vertex: {
                module: skyboxModule,
                buffers: [{
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x2',
                    }]
                }]
            },
            fragment: {
                module: skyboxModule,
                targets: [{ format: this.format }],
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'less-equal',
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });

        const clipQuadVertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);

        this.clipQuadBuffer = this.device.createBuffer({
            size: clipQuadVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.clipQuadBuffer, 0, clipQuadVertices);

        this.recreateDepthTexture();
    }

    setEnvironment(images) {
        this.environmentTexture?.destroy();
        this.environmentTexture = this.device.createTexture({
            size: [images[0].width, images[0].height, 6],
            format: 'rgba8unorm-srgb',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        for (let i = 0; i < images.length; i++) {
            this.device.queue.copyExternalImageToTexture(
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

        this.skyboxBindGroup = this.device.createBindGroup({
            layout: this.skyboxPipeline.getBindGroupLayout(1),
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

    prepareNode(node) {
        if (this.gpuObjects.has(node)) {
            return this.gpuObjects.get(node);
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

        const gpuObjects = { modelUniformBuffer, modelBindGroup };
        this.gpuObjects.set(node, gpuObjects);
        return gpuObjects;
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

        const unprojectUniformBuffer = this.device.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const unprojectBindGroup = this.device.createBindGroup({
            layout: this.skyboxPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: unprojectUniformBuffer } }
            ],
        })

        const gpuObjects = {
            cameraUniformBuffer,
            cameraBindGroup,
            unprojectUniformBuffer,
            unprojectBindGroup,
        };
        this.gpuObjects.set(camera, gpuObjects);
        return gpuObjects;
    }

    prepareTexture(texture) {
        if (this.gpuObjects.has(texture)) {
            return this.gpuObjects.get(texture);
        }

        const { gpuTexture } = this.prepareImage(texture.image, texture.isSRGB);
        const { gpuSampler } = this.prepareSampler(texture.sampler);

        const gpuObjects = { gpuTexture, gpuSampler };
        this.gpuObjects.set(texture, gpuObjects);
        return gpuObjects;
    }

    prepareMaterial(material) {
        if (this.gpuObjects.has(material)) {
            return this.gpuObjects.get(material);
        }

        const baseTexture = this.prepareTexture(material.baseTexture);

        const materialUniformBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const materialBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(2),
            entries: [
                { binding: 0, resource: { buffer: materialUniformBuffer } },
                { binding: 1, resource: baseTexture.gpuTexture.createView() },
                { binding: 2, resource: baseTexture.gpuSampler },
            ],
        });

        const gpuObjects = { materialUniformBuffer, materialBindGroup };
        this.gpuObjects.set(material, gpuObjects);
        return gpuObjects;
    }

    render(scene, camera) {
        if (this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height) {
            this.recreateDepthTexture();
        }

        const encoder = this.device.createCommandEncoder();
        this.renderPass = encoder.beginRenderPass({
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
        this.renderPass.setPipeline(this.pipeline);

        const cameraComponent = camera.getComponentOfType(Camera);
        const cameraMatrix = getGlobalModelMatrix(camera);
        const viewMatrix = getGlobalViewMatrix(camera);
        const projectionMatrix = getProjectionMatrix(camera);
        const unprojectionMatrix = mat4.invert(mat4.create(), projectionMatrix);
        const unprojectMatrix = mat4.multiply(mat4.create(), cameraMatrix, unprojectionMatrix);
        const cameraPosition = mat4.getTranslation(vec3.create(), cameraMatrix);
        const {
            cameraUniformBuffer,
            cameraBindGroup,
            unprojectUniformBuffer,
            unprojectBindGroup,
        } = this.prepareCamera(cameraComponent);
        this.device.queue.writeBuffer(cameraUniformBuffer, 0, viewMatrix);
        this.device.queue.writeBuffer(cameraUniformBuffer, 64, projectionMatrix);
        this.device.queue.writeBuffer(cameraUniformBuffer, 128, cameraPosition);
        this.device.queue.writeBuffer(unprojectUniformBuffer, 0, unprojectMatrix);
        this.renderPass.setBindGroup(0, cameraBindGroup);

        this.renderPass.setBindGroup(3, this.environmentBindGroup);

        this.renderNode(scene);

        this.renderPass.setPipeline(this.skyboxPipeline);
        this.renderPass.setVertexBuffer(0, this.clipQuadBuffer);
        this.renderPass.setBindGroup(0, unprojectBindGroup);
        this.renderPass.setBindGroup(1, this.skyboxBindGroup);
        this.renderPass.draw(4);

        this.renderPass.end();
        this.device.queue.submit([encoder.finish()]);
    }

    renderNode(node, modelMatrix = mat4.create()) {
        const localMatrix = getLocalModelMatrix(node);
        modelMatrix = mat4.multiply(mat4.create(), modelMatrix, localMatrix);
        const normalMatrix = mat4.normalFromMat4(mat4.create(), modelMatrix);

        const { modelUniformBuffer, modelBindGroup } = this.prepareNode(node);
        this.device.queue.writeBuffer(modelUniformBuffer, 0, modelMatrix);
        this.device.queue.writeBuffer(modelUniformBuffer, 64, normalMatrix);
        this.renderPass.setBindGroup(1, modelBindGroup);

        for (const model of node.getComponentsOfType(Model)) {
            this.renderModel(model);
        }

        for (const child of node.children) {
            this.renderNode(child, modelMatrix);
        }
    }

    renderModel(model) {
        for (const primitive of model.primitives) {
            this.renderPrimitive(primitive);
        }
    }

    renderPrimitive(primitive) {
        const { materialUniformBuffer, materialBindGroup } = this.prepareMaterial(primitive.material);
        this.device.queue.writeBuffer(materialUniformBuffer, 0, new Float32Array([
            ...primitive.material.baseFactor,
            primitive.material.reflectance,
            primitive.material.transmittance,
            primitive.material.ior,
            primitive.material.effect
        ]));
        this.renderPass.setBindGroup(2, materialBindGroup);

        const { vertexBuffer, indexBuffer } = this.prepareMesh(primitive.mesh, vertexBufferLayout);
        this.renderPass.setVertexBuffer(0, vertexBuffer);
        this.renderPass.setIndexBuffer(indexBuffer, 'uint32');

        this.renderPass.drawIndexed(primitive.mesh.indices.length);
    }

}
