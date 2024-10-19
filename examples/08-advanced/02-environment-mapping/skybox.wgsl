struct VertexInput {
    @location(0) position: vec2f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) texcoords: vec3f,
}

struct FragmentInput {
    @location(0) texcoords: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    unprojectMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var uEnvironmentTexture: texture_cube<f32>;
@group(1) @binding(1) var uEnvironmentSampler: sampler;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.clipPosition = vec4f(input.position, 1, 1);
    let near = camera.unprojectMatrix * vec4(input.position, 0, 1);
    let far = camera.unprojectMatrix * vec4(input.position, 1, 1);
    output.texcoords = far.xyz / far.w - near.xyz / near.w;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let color = textureSample(uEnvironmentTexture, uEnvironmentSampler, input.texcoords);
    output.color = pow(color, vec4(vec3(1 / 2.2), 1));

    return output;
}
