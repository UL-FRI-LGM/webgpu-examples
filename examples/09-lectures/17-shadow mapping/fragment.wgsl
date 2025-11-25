override shadowDepthTextureSize: f32 = 1024.0;

struct Scene {
  lightViewProjMatrix : mat4x4<f32>,
  cameraViewProjMatrix : mat4x4<f32>,
  lightPos : vec3<f32>,
}

@group(0) @binding(0) var<uniform> scene : Scene;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

struct FragmentInput {
  @location(0) shadowPos : vec3<f32>,
  @location(1) fragPos : vec4<f32>,
  @location(2) fragNorm : vec3<f32>,
}

const albedo = vec3<f32>(0.95);
const ambientFactor = 0.2;

@fragment
fn main(input : FragmentInput) -> @location(0) vec4<f32> {
  // Percentage-closer filtering. Sample 9 texels in the region to smooth the result.
  var visibility = 0.0;
  let oneOverShadowDepthTextureSize = 1.0 / shadowDepthTextureSize;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2<f32>(vec2(x, y)) * oneOverShadowDepthTextureSize;
      // if z - 0.07 is less than the value in texture, then the fragment is visible
      visibility += textureSampleCompare(
        shadowMap, shadowSampler,
        input.shadowPos.xy + offset, input.shadowPos.z - 0.07,
      );
    }
  }
  visibility /= 9.0;

  let lambertFactor = max(dot(normalize(scene.lightPos - input.fragPos.xyz), input.fragNorm), 0.0);
  let lightingFactor = min(ambientFactor + visibility * lambertFactor, 1.0);

  return vec4(lightingFactor * albedo, 1.0);
}
