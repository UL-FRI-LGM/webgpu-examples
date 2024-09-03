import { GUI } from 'dat';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const vertexBufferLayout = {
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2',
        },
        {
            shaderLocation: 1,
            offset: 8,
            format: 'float32x4',
        },
    ],
    arrayStride: 24,
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
    layout: 'auto',
});

const vertices = new Float32Array([
     0.0,  0.5,     1, 0, 0, 1,
    -0.5, -0.5,     0, 1, 0, 1,
     0.5, -0.5,     0, 0, 1, 1,
]);

const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});

new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
vertexBuffer.unmap();

const indices = new Uint32Array([
    0, 1, 2,
]);

const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
});

new Uint32Array(indexBuffer.getMappedRange()).set(indices);
indexBuffer.unmap();

const uniformBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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

const translation = {
    x: 0,
    y: 0,
};

function render() {
    queue.writeBuffer(uniformBuffer, 0,
        new Float32Array([translation.x, translation.y]));

    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store',
            }
        ]
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.drawIndexed(3);
    renderPass.end();
    queue.submit([encoder.finish()]);
}

render();

const gui = new GUI();
gui.add(translation, 'x', -1, 1).onChange(render);
gui.add(translation, 'y', -1, 1).onChange(render);
