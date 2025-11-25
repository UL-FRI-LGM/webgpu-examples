struct VertexInput {
    @location(0) position : vec4f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(perspective) cubeUV : vec4f,
}

struct FragmentInput {
    @location(0) @interpolate(perspective) cubeUV : vec4f,
}

struct FragmentOutput {
    @builtin(frag_depth) frag_depth: f32,
    @location(0) color : vec4f,
}

struct ModelUniforms {
    modelViewMatrix : mat4x4f,
    projectionMatrix : mat4x4f,
    normalMatrix : mat4x4f,
}

@group(0) @binding(0) var<uniform> model : ModelUniforms;
@group(0) @binding(1) var uEnvironmentTexture : texture_cube<f32>;
@group(0) @binding(2) var uEnvironmentSampler : sampler;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    //output.position = model.modelViewMatrix * input.position;
    output.position = model.modelViewMatrix * vec4f(input.position.xyz,0) + vec4f(0,0,0,1); // clear translation
    output.position = model.projectionMatrix * output.position;
    output.cubeUV = input.position;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    var cubemapVec = input.cubeUV.xyz;
    cubemapVec.z = -cubemapVec.z; // flip z to world (z+) space
    output.color = textureSample(uEnvironmentTexture, uEnvironmentSampler, cubemapVec.xyz);
    return output;
}
