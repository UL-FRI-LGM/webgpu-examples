struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
    @location(2) texcoords: vec2f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) vertPosition : vec4f,
}

struct FragmentInput {
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) fragPosition: vec4f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

struct ModelUniforms {
    modelViewProjectionMatrix : mat4x4f,
    normalMatrix : mat4x4f,
    modelMatrix : mat4x4f,
    cameraPosition: vec3f,
}

@group(0) @binding(0) var<uniform> model : ModelUniforms;
@group(0) @binding(1) var uEnvironmentTexture : texture_cube<f32>;
@group(0) @binding(2) var uEnvironmentSampler : sampler;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = model.modelViewProjectionMatrix * vec4(input.position, 1);
    output.normal = (model.normalMatrix * vec4(input.normal,0)).xyz; // world space
    output.vertPosition = model.modelMatrix * vec4(input.position, 1); // world space
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    var n: vec3f = normalize(input.normal); // world space
    var eyeVec: vec3f = normalize(input.fragPosition.xyz - model.cameraPosition); // world space
    let R = reflect(eyeVec, n); // world space
    let reflectedColor = textureSample(uEnvironmentTexture, uEnvironmentSampler, R);

    output.color = reflectedColor;
    return output;
}
