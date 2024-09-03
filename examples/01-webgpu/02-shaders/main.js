const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    layout: 'auto',
});

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
renderPass.draw(3);
renderPass.end();
queue.submit([encoder.finish()]);
