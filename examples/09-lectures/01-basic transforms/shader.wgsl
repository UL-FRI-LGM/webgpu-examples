struct VertexInput {
    @location(0) position : vec3f,
    @location(1) color : vec4f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(flat) color : vec4f,
}

struct FragmentInput {
    @location(0) @interpolate(flat) color : vec4f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

@group(0) @binding(0) var<uniform> modelViewProjectionMatrix : mat4x4f;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = modelViewProjectionMatrix * vec4(input.position, 1);
    output.color = input.color;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    output.color = input.color;
    return output;
}
