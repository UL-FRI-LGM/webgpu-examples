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
}

struct FragmentInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    position: vec3f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
    reflectance: f32,
    transmittance: f32,
    ior: f32,
    effect: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;
@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var uBaseTexture: texture_2d<f32>;
@group(2) @binding(2) var uBaseSampler: sampler;
@group(3) @binding(0) var uEnvironmentTexture: texture_cube<f32>;
@group(3) @binding(1) var uEnvironmentSampler: sampler;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let position = model.modelMatrix * vec4(input.position, 1);

    output.position = position.xyz;
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * position;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let N = normalize(input.normal);
    let V = normalize(camera.position - input.position);
    let R = reflect(-V, N);
    let T = refract(-V, N, material.ior);

    let baseColor = textureSample(uBaseTexture, uBaseSampler, input.texcoords);
    let reflectedColor = textureSample(uEnvironmentTexture, uEnvironmentSampler, R);
    let refractedColor = textureSample(uEnvironmentTexture, uEnvironmentSampler, T);

    let reflection = mix(baseColor, reflectedColor, material.reflectance);
    let refraction = mix(baseColor, refractedColor, material.transmittance);

    let finalColor = mix(reflection, refraction, material.effect);

    output.color = vec4(pow(finalColor.rgb, vec3(1 / 2.2)), finalColor.a);

    return output;
}
