struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
    @location(3) tangent: vec3f,
}

struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
    @location(3) tangent: vec3f,
}

struct FragmentInput {
    @location(0) position: vec3f,
    @location(1) texcoords: vec2f,
    @location(2) normal: vec3f,
    @location(3) tangent: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    position: vec3f,
}

struct LightUniforms {
    color: vec3f,
    position: vec3f,
    attenuation: vec3f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

struct MaterialUniforms {
    baseFactor: vec4f,
    normalFactor: f32,
    diffuse: f32,
    specular: f32,
    shininess: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@group(2) @binding(0) var<uniform> model: ModelUniforms;
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var uBaseTexture: texture_2d<f32>;
@group(3) @binding(2) var uBaseSampler: sampler;
@group(3) @binding(3) var uNormalTexture: texture_2d<f32>;
@group(3) @binding(4) var uNormalSampler: sampler;

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let position = model.modelMatrix * vec4(input.position, 1);
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * position;
    output.position = position.xyz;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;
    output.tangent = model.normalMatrix * input.tangent;

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let baseColor = textureSample(uBaseTexture, uBaseSampler, input.texcoords);
    let normalColor = textureSample(uNormalTexture, uNormalSampler, input.texcoords);
    let scaledNormal = normalize((normalColor.xyz * 2 - 1) * vec3(vec2(material.normalFactor), 1));

    let normal = normalize(input.normal);
    let tangent = normalize(input.tangent);
    let bitangent = normalize(cross(normal, tangent));

    let tangentMatrix = mat3x3(tangent, bitangent, normal);
    let transformedNormal = tangentMatrix * scaledNormal;

    let surfacePosition = input.position;
    let d = distance(surfacePosition, light.position);
    let attenuation = 1 / dot(light.attenuation, vec3(1, d, d * d));

    let N = transformedNormal;
    let L = normalize(light.position - surfacePosition);
    let V = normalize(camera.position - surfacePosition);
    let R = normalize(reflect(-L, N));

    let lambert = max(dot(N, L), 0.0) * material.diffuse;
    let phong = pow(max(dot(V, R), 0.0), material.shininess) * material.specular;

    let diffuseLight = lambert * attenuation * light.color;
    let specularLight = phong * attenuation * light.color;

    let finalColor = baseColor.rgb * diffuseLight + specularLight;
    output.color = pow(vec4(finalColor, 1), vec4(1 / 2.2));

    return output;
}
