struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
    @location(3) shadowPosition: vec4f,
}

struct FragmentInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
    @location(3) shadowPosition: vec4f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
}

struct LightUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    position: vec3f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;
@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var baseTexture: texture_2d<f32>;
@group(2) @binding(2) var baseSampler: sampler;
@group(3) @binding(0) var<uniform> light: LightUniforms;
@group(3) @binding(1) var shadowTexture: texture_depth_2d;
@group(3) @binding(2) var shadowSampler: sampler_comparison;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let position = model.modelMatrix * vec4(input.position, 1);

    output.position = position.xyz;
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * position;
    output.shadowPosition = light.projectionMatrix * light.viewMatrix * position;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let N = normalize(input.normal);
    let L = normalize(light.position - input.position);

    let lambert = max(dot(N, L), 0.0);

    let baseColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;

    let shadowPosition = input.shadowPosition.xyz / input.shadowPosition.w;
    let shadowTexcoords = shadowPosition.xy * vec2(0.5, -0.5) + 0.5;
    let shadowFactor = textureSampleCompare(shadowTexture, shadowSampler, shadowTexcoords.xy, shadowPosition.z - 0.002);

    let finalColor = baseColor * vec4(vec3(0.1 + lambert * shadowFactor), 1);

    output.color = vec4(pow(finalColor.rgb, vec3(1 / 2.2)), finalColor.a);

    return output;
}
