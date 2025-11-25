@group(0) @binding(0) var gBufferAlbedo: texture_2d<f32>;
@group(0) @binding(1) var gBufferPosView: texture_2d<f32>;
@group(0) @binding(2) var gBufferNormal: texture_2d<f32>;
@group(0) @binding(3) var occlusionSamplesTexture: texture_2d<f32>;
@group(0) @binding(4) var<uniform> uniforms : Uniforms;

struct Uniforms {
    projectionMatrix: mat4x4f,
    lightPosView : vec3f,
}

const SAO_SAMPLECOUNT: i32 = 32;
const SAO_OCCLUSIONSCALE: f32 = 0.1;
const SAO_OCCLUSIONRANGE: f32 = 1;
const SAO_DEPTHBIAS: f32 = 0.05;


fn rand(co: vec2f) -> f32 {
    return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn ssao(coordUV: vec2f, viewPos: vec3f, normal: vec3f) -> vec3f {
    let randomOffset = rand(coordUV);

    let randomVector = textureLoad(occlusionSamplesTexture, vec2i(i32(floor(randomOffset * f32(textureDimensions(occlusionSamplesTexture).x))), 0), 0).xyz;

    let tangent = normalize(randomVector - normal * dot(randomVector, normal));
    let bitangent = cross(normal, tangent);
    let TBN = mat3x3f(tangent, bitangent, normal);
    var occlusion: f32 = 0.0;

    for(var i: i32 = 0; i < SAO_SAMPLECOUNT; i++) {
        var direction = textureLoad(occlusionSamplesTexture, vec2<i32>(i, 0), 0).xyz;
        let probe = viewPos + normalize(TBN * direction) * SAO_OCCLUSIONSCALE;

        var probeProjection = uniforms.projectionMatrix * vec4<f32>(probe, 1.0);
        probeProjection = probeProjection / probeProjection.w;

        var sampleCoord = probeProjection.xy * 0.5 + 0.5;
        sampleCoord.y = 1.0 - sampleCoord.y;
        let referenceDepthView = textureLoad(gBufferPosView, vec2i(floor(sampleCoord * vec2f(textureDimensions(gBufferPosView)))), 0).z; // was: depth

        let rangeCheck = smoothstep(0.0, 1.0, SAO_OCCLUSIONRANGE * SAO_OCCLUSIONSCALE /abs(viewPos.z - referenceDepthView));

        if (referenceDepthView > probe.z + SAO_DEPTHBIAS) {
            occlusion += rangeCheck;
        }
    }

    return vec3f(1.0 - occlusion / f32(SAO_SAMPLECOUNT));
}

@fragment
fn main(@builtin(position) coord : vec4f) -> @location(0) vec4f {

  if (coord.z >= 1.0) { // don't calculate for background
    discard;
  }

  let loc = vec2i(floor(coord.xy));
  let positionView = textureLoad(gBufferPosView, loc, 0).xyz;
  let normal = normalize(textureLoad(gBufferNormal, loc, 0).xyz);
  let albedo = textureLoad(gBufferAlbedo, loc, 0).rgb;

  let coordUV: vec2f = coord.xy / vec2f(textureDimensions(gBufferPosView));
  var vis = ssao(coordUV, positionView, normal);
  //return vec4(vis, 1.0);
  return vec4(albedo.r * vis.x, albedo.g * 1, albedo.b * 1, 1.0);
}

