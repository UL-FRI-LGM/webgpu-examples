struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
}

struct FragmentInput {
    @builtin(position) position: vec4f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
}

const positions = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
);

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(positions[input.vertexIndex], 0, 1);
    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = vec4f(1, 0, 0, 1);
    return output;
}
