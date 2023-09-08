struct VertexInput {
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
    @location(3) tangent : vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition : vec4f,
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
    @location(3) tangent : vec3f,
}

struct FragmentInput {
    @location(0) position : vec3f,
    @location(1) texcoords : vec2f,
    @location(2) normal : vec3f,
    @location(3) tangent : vec3f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

struct CameraUniforms {
    viewMatrix : mat4x4f,
    projectionMatrix : mat4x4f,
    time : f32,
}

struct ModelUniforms {
    modelMatrix : mat4x4f,
    normalMatrix : mat3x3f,
}

@group(0) @binding(0) var<uniform> camera : CameraUniforms;
@group(1) @binding(0) var<uniform> model : ModelUniforms;
@group(2) @binding(0) var uTexture : texture_2d<f32>;
@group(2) @binding(1) var uSampler : sampler;
@group(2) @binding(2) var uNormalTexture : texture_2d<f32>;
@group(2) @binding(3) var uNormalSampler : sampler;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    let position = model.modelMatrix * vec4(input.position, 1);
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * position;
    output.position = position.xyz;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;
    output.tangent = model.normalMatrix * input.tangent;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    let baseColor = textureSample(uTexture, uSampler, input.texcoords);
    let normalColor = textureSample(uNormalTexture, uNormalSampler, input.texcoords);
    const normalScale = 1.0;
    let scaledNormal = normalize((normalColor.xyz * 2 - 1) * vec3(normalScale, normalScale, 1));

    let normal = normalize(input.normal);
    let tangent = normalize(input.tangent);
    let bitangent = normalize(cross(tangent, normal));

    let tangentMatrix = mat3x3(tangent, bitangent, normal);
    let transformedNormal = tangentMatrix * scaledNormal;

    let lightPosition = vec3f(sin(camera.time * 3) * 10, 5, 5);
    let fragmentPosition = input.position;

    let N = transformedNormal;
    let L = normalize(lightPosition - fragmentPosition);

    let diffuse = max(dot(N, L), 0.0);

    output.color = vec4(baseColor.xyz * diffuse, 1);
    return output;
}
