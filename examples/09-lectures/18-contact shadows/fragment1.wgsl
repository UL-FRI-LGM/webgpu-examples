
struct FragmentInput {
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) fragPosition: vec3f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

struct Uniforms {
    projectionMatrix: mat4x4f,
    invProjectionMatrix: mat4x4f,
    lightPosView : vec3f,
}

@group(0) @binding(1) var<uniform> uniforms : Uniforms;

const albedo = vec3<f32>(0.95);
const ambientFactor = 0.2;

@fragment
fn main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    var visibility = 1.0;

    var lightVec: vec3f = normalize(uniforms.lightPosView - input.fragPosition);
    var n: vec3f = normalize(input.normal);

    let lambertFactor = max(dot(lightVec, n), 0.0);
    let lightingFactor = min(ambientFactor + visibility * lambertFactor, 1.0);

    output.color = vec4(lightingFactor * albedo, 1.0);
    return output;
}

