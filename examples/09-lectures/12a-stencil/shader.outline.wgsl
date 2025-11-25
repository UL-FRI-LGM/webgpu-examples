struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

struct ModelUniforms {
    modelViewProjectionMatrix : mat4x4f,
}

@group(0) @binding(0) var<uniform> model : ModelUniforms;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = model.modelViewProjectionMatrix * vec4(input.position, 1);
    return output;
}

@fragment
fn fragment() -> FragmentOutput {
    var output : FragmentOutput;

    output.color = vec4(0, 1, 0, 1);
    return output;
}
