struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) texcoords: vec2f,
    @location(2) diffuseLight: vec3f,
}

struct FragmentInput {
    @location(1) texcoords: vec2f,
    @location(2) diffuseLight: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
}

struct LightUniforms {
    color: vec3f,
    direction: vec3f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@group(2) @binding(0) var<uniform> model: ModelUniforms;
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var baseTexture: texture_2d<f32>;
@group(3) @binding(2) var baseSampler: sampler;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.position = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * vec4(input.position, 1);
    output.texcoords = input.texcoords;

    let N = model.normalMatrix * input.normal;
    let L = light.direction;

    let lambert = max(dot(N, L), 0.0);
    output.diffuseLight = lambert * light.color;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let baseColor = textureSample(baseTexture, baseSampler, input.texcoords) * material.baseFactor;
    let finalColor = baseColor.rgb * input.diffuseLight;

    output.color = pow(vec4(finalColor, 1), vec4(1 / 2.2));

    return output;
}
