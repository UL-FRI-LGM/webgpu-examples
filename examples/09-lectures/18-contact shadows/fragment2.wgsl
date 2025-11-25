@group(0) @binding(0) var gBufferAlbedo: texture_2d<f32>;
@group(0) @binding(1) var gBufferDepth: texture_depth_2d;
@group(0) @binding(2) var<uniform> uniforms : Uniforms;

struct Uniforms {
    projectionMatrix: mat4x4f,
    invProjectionMatrix: mat4x4f,
    lightPosView : vec3f,
}

const SSS_MAX_STEPS: u32 = 16u;          // Max ray steps, affects quality and performance
const SSS_RAY_MAX_DISTANCE: f32 = 0.05;  // Max shadow length, longer shadows are less accurate
const SSS_THICKNESS: f32 = 0.02;         // Depth testing thickness
const SSS_STEP_LENGTH: f32 = SSS_RAY_MAX_DISTANCE / f32(SSS_MAX_STEPS);


fn projectUV(positionView: vec3f) -> vec2f {
    let clip = uniforms.projectionMatrix * vec4f(positionView, 1.0);
    let ndc = clip.xyz / clip.w;
    var uv = vec2f(ndc.xy * 0.5 + 0.5);
    uv.y = 1.0 - uv.y;
    return uv;
}

fn inScreen(uv: vec2f) -> bool {
    return all(uv >= vec2f(0.0)) && all(uv <= vec2f(1.0));
}

fn screenFade(uv: vec2<f32>) -> f32 {
    let border = 0.1;
    let fade_x = smoothstep(0.0, border, uv.x) * smoothstep(1.0, 1.0 - border, uv.x);
    let fade_y = smoothstep(0.0, border, uv.y) * smoothstep(1.0, 1.0 - border, uv.y);
    return fade_x * fade_y;
}


// Main screen space shadows function
fn screenSpaceShadows(positionView: vec3f) -> f32 {
    // Compute ray position and direction (in view-space)
    let rayDirectionView = normalize(uniforms.lightPosView - positionView);
    var rayPositionView = positionView;

    let rayStep = rayDirectionView * SSS_STEP_LENGTH;
    let bufferSize = textureDimensions(gBufferDepth);

    // Ray march towards the light
    var occlusion: f32 = 0.0;
    var rayUV: vec2f = vec2f(0.0);

    for(var i: u32 = 0u; i < SSS_MAX_STEPS; i = i + 1u) {
        rayPositionView = rayPositionView + rayStep;
        rayUV = projectUV(rayPositionView);

        // Ensure the UV coordinates are inside the screen - between 0 and 1
        if (inScreen(rayUV)) {
            // Compute the difference between the ray's and the camera's depth
            let coords: vec2i = vec2i(floor(rayUV * vec2f(bufferSize)));

            // load from depth buffer and unproject
            let depth = textureLoad(gBufferDepth, coords, 0);

            let depthView = uniforms.invProjectionMatrix * vec4f(0, 0, depth, 1.0);
            let depthZ = depthView.z / depthView.w;

            let depth_delta = -(rayPositionView.z - depthZ);

            // Check if the camera can't "see" the ray
            if (depth_delta > 0.0 && depth_delta < SSS_THICKNESS) {
                // Mark as occluded
                occlusion += 1.0;
            }
        }
    }

    occlusion /= f32(SSS_MAX_STEPS);
    occlusion = min(occlusion * screenFade(rayUV),0.4);

    // Convert to visibility
    return 1.0 - occlusion;
}

fn viewFromScreen(coord : vec2f, depth_sample: f32) -> vec3f {
  // reconstruct world-space position from the screen coordinate.
  let posNDC = vec4(coord.x * 2.0 - 1.0, (1.0 - coord.y) * 2.0 - 1.0, depth_sample, 1.0);
  let posViewW = uniforms.invProjectionMatrix * posNDC;
  let posView = posViewW.xyz / posViewW.w;
  return posView;
}


@fragment
fn main(@builtin(position) coord : vec4f) -> @location(0) vec4f {

  let depth = textureLoad(gBufferDepth, vec2i(floor(coord.xy)), 0);

  if (depth >= 1.0) { // don't calculate for background
    discard;
  }

  let bufferSize = textureDimensions(gBufferDepth);
  let coordUV: vec2f = coord.xy / vec2f(bufferSize);
  let posView = viewFromScreen(coordUV, depth);
  let vis = screenSpaceShadows(posView);

  let albedo = textureLoad(
    gBufferAlbedo,
    vec2i(floor(coord.xy)),
    0
  ).rgb;
  return vec4(albedo.r * vis, albedo.g, albedo.b, 1.0);
}
