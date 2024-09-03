const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const positionsBufferLayout = {
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2',
        },
    ],
    arrayStride: 8,
};

const colorsBufferLayout = {
    attributes: [
        {
            shaderLocation: 1,
            offset: 0,
            format: 'float32x4',
        },
    ],
    arrayStride: 16,
};

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        buffers: [ positionsBufferLayout, colorsBufferLayout ],
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    layout: 'auto',
});

const positions = new Float32Array([
     0.0,  0.5,
    -0.5, -0.5,
     0.5, -0.5,
]);

const positionsBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});

new Float32Array(positionsBuffer.getMappedRange()).set(positions);
positionsBuffer.unmap();

const colors = new Float32Array([
    1, 0, 0, 1,
    0, 1, 0, 1,
    0, 0, 1, 1,
]);

const colorsBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});

new Float32Array(colorsBuffer.getMappedRange()).set(colors);
colorsBuffer.unmap();

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
renderPass.setVertexBuffer(0, positionsBuffer);
renderPass.setVertexBuffer(1, colorsBuffer);
renderPass.draw(3);
renderPass.end();
queue.submit([encoder.finish()]);
