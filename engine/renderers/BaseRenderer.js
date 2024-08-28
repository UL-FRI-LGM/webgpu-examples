import * as WebGPU from '../WebGPU.js';

import { createVertexBuffer } from '../core/VertexUtils.js';

export class BaseRenderer {

    constructor(canvas) {
        this.canvas = canvas;
        this.gpuObjects = new WeakMap();
    }

    async initialize() {
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        const context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        this.device = device;
        this.context = context;
        this.format = format;
    }

    prepareImage(image, isSRGB = false) {
        if (this.gpuObjects.has(image)) {
            return this.gpuObjects.get(image);
        }

        const gpuTexture = WebGPU.createTexture(this.device, {
            source: image,
            format: isSRGB ? 'rgba8unorm-srgb' : 'rgba8unorm',
        });

        const gpuObjects = { gpuTexture };
        this.gpuObjects.set(image, gpuObjects);
        return gpuObjects;
    }

    prepareSampler(sampler) {
        if (this.gpuObjects.has(sampler)) {
            return this.gpuObjects.get(sampler);
        }

        const gpuSampler = this.device.createSampler(sampler);

        const gpuObjects = { gpuSampler };
        this.gpuObjects.set(sampler, gpuObjects);
        return gpuObjects;
    }

    prepareMesh(mesh, layout) {
        if (this.gpuObjects.has(mesh)) {
            return this.gpuObjects.get(mesh);
        }

        const vertexBufferArrayBuffer = createVertexBuffer(mesh.vertices, layout);
        const vertexBuffer = WebGPU.createBuffer(this.device, {
            data: vertexBufferArrayBuffer,
            usage: GPUBufferUsage.VERTEX,
        });

        const indexBufferArrayBuffer = new Uint32Array(mesh.indices).buffer;
        const indexBuffer = WebGPU.createBuffer(this.device, {
            data: indexBufferArrayBuffer,
            usage: GPUBufferUsage.INDEX,
        });

        const gpuObjects = { vertexBuffer, indexBuffer };
        this.gpuObjects.set(mesh, gpuObjects);
        return gpuObjects;
    }

}
