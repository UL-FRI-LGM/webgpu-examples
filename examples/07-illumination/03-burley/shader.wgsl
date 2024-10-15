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
    metalness: f32,
    roughness: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@group(2) @binding(0) var<uniform> model: ModelUniforms;
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var uBaseTexture: texture_2d<f32>;
@group(3) @binding(2) var uBaseSampler: sampler;

const PI = 3.14159265358979;
const GAMMA = 2.2;

fn F_Schlick_vec3f(f0: vec3f, f90: vec3f, VdotH: f32) -> vec3f {
    return f0 + (f90 - f0) * pow(1 - VdotH, 5.0);
}

fn F_Schlick_f32(f0: f32, f90: f32, VdotH: f32) -> f32 {
    return f0 + (f90 - f0) * pow(1 - VdotH, 5.0);
}

fn V_GGX(NdotL: f32, NdotV: f32, roughness: f32) -> f32 {
    let roughnessSq = roughness * roughness;

    let GGXV = NdotV + sqrt(NdotV * NdotV * (1 - roughnessSq) + roughnessSq);
    let GGXL = NdotL + sqrt(NdotL * NdotL * (1 - roughnessSq) + roughnessSq);

    return 1 / (GGXV * GGXL);
}

fn D_GGX(NdotH: f32, roughness: f32) -> f32 {
    let roughnessSq = roughness * roughness;
    let f = (NdotH * NdotH) * (roughnessSq - 1) + 1;
    return roughnessSq / (PI * f * f);
}

fn Fd_Burley(NdotV: f32, NdotL: f32, VdotH: f32, roughness: f32) -> f32 {
    let f90 = 0.5 + 2 * roughness * VdotH * VdotH;
    let lightScatter = F_Schlick_f32(1.0, f90, NdotL);
    let viewScatter = F_Schlick_f32(1.0, f90, NdotV);
    return lightScatter * viewScatter / PI;
}

fn BRDF_diffuse(f0: vec3f, f90: vec3f, diffuseColor: vec3f, VdotH: f32) -> vec3f {
    return (1 - F_Schlick_vec3f(f0, f90, VdotH)) * (diffuseColor / PI);
}

fn BRDF_specular(f0: vec3f, f90: vec3f, roughness: f32, VdotH: f32, NdotL: f32, NdotV: f32, NdotH: f32) -> vec3f{
    let F = F_Schlick_vec3f(f0, f90, VdotH);
    let V = V_GGX(NdotL, NdotV, roughness);
    let D = D_GGX(NdotH, roughness);
    return F * V * D;
}

fn linearTosRGB(color: vec3f) -> vec3f {
    return pow(color, vec3f(1 / GAMMA));
}

fn sRGBToLinear(color: vec3f) -> vec3f {
    return pow(color, vec3f(GAMMA));
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = camera.projectionMatrix * camera.viewMatrix * model.modelMatrix * vec4f(input.position, 1);
    output.position = (model.modelMatrix * vec4f(input.position, 1)).xyz;
    output.texcoords = input.texcoords;
    output.normal = model.normalMatrix * input.normal;
    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let baseColor = textureSample(uBaseTexture, uBaseSampler, input.texcoords);

    let surfacePosition = input.position;
    let d = distance(surfacePosition, light.position);
    let attenuation = 1 / dot(light.attenuation, vec3f(1, d, d * d));
    let lightColor = attenuation * light.color;

    let N = normalize(input.normal);
    let L = normalize(light.position - surfacePosition);
    let V = normalize(camera.position - surfacePosition);
    let H = normalize(L + V);

    let NdotL = max(dot(N, L), 0.0);
    let NdotV = max(dot(N, V), 0.0);
    let NdotH = max(dot(N, H), 0.0);
    let VdotH = max(dot(V, H), 0.0);

    let f0 = mix(vec3f(0.04), baseColor.rgb, material.metalness);
    let f90 = vec3f(1);
    let diffuseColor = mix(baseColor.rgb, vec3f(0), material.metalness);

    let diffuse = lightColor * NdotL * BRDF_diffuse(f0, f90, diffuseColor, VdotH);
    let specular = lightColor * NdotL * BRDF_specular(f0, f90, material.roughness, VdotH, NdotL, NdotV, NdotH);

    let finalColor = diffuse + specular;
    output.color = vec4f(linearTosRGB(finalColor), 1);

    return output;
}
