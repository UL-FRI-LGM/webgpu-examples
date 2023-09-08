struct VertexInput {
    @location(0) position : vec2f,
    @location(1) color : vec4f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
}

struct FragmentInput {
    @location(0) color : vec4f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4(input.position, 0, 1);
    output.color = input.color;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    output.color = pow(input.color, vec4(1 / 2.2));
    return output;
}
