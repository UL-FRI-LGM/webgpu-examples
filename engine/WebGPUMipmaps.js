import { MultiKeyWeakMap } from './MultiKeyWeakMap.js';

const code = `
const positions = array(
    vec2f(0, 0),
    vec2f(2, 0),
    vec2f(0, 2),
);

struct Interpolants {
    @builtin(position) position: vec4f,
    @location(0) texcoords: vec2f,
}

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

@vertex
fn vertex(@builtin(vertex_index) index: u32) -> Interpolants {
    var output: Interpolants;
    let position = positions[index];
    output.position = vec4f(position * 2 - 1, 0, 1);
    output.texcoords = position;
    return output;
}

@fragment
fn fragment(input: Interpolants) -> @location(0) vec4f {
    return textureSample(inputTexture, inputSampler, input.texcoords);
}
`;

const pipelines = new MultiKeyWeakMap();
const formats = new Map(); // map string --> object (WeakMap cannot key strings)

function getOrCreateMipmapPipeline(device, format) {
    if (!formats.has(format)) {
        formats.set(format, { format });
    }

    const key = [device, formats.get(format)];
    if (pipelines.has(key)) {
        return pipelines.get(key);
    }

    const module = device.createShaderModule({ code });
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module },
        fragment: {
            module,
            targets: [{ format }],
        },
    });

    pipelines.set(key, pipeline);
    return pipeline;
}

export function mipLevelCount(size) {
    return 1 + Math.floor(Math.log2(Math.max(...size)));
}

export function generateMipmaps2D(device, texture) {
    const pipeline = getOrCreateMipmapPipeline(device, texture.format);

    for (let i = 1; i < texture.mipLevelCount; i++) {
        const inputView = texture.createView({
            baseMipLevel: i - 1,
            mipLevelCount: 1,
        });

        const outputView = texture.createView({
            baseMipLevel: i,
            mipLevelCount: 1,
        });

        const inputSampler = device.createSampler({
            minFilter: 'linear',
        });

        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: inputView },
                { binding: 1, resource: inputSampler },
            ],
        });

        const encoder = device.createCommandEncoder();
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: outputView,
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(3);
        renderPass.end();
        device.queue.submit([encoder.finish()]);
    }
}
