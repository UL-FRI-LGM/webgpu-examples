struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
    @location(2) uv : vec2f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) vertPositionView : vec3f,
}

struct ModelUniforms {
    modelViewMatrix : mat4x4f,
    modelViewProjectionMatrix : mat4x4f,
    normalMatrix : mat4x4f,
}


@group(0) @binding(0) var<uniform> model : ModelUniforms;


@vertex
fn main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = model.modelViewProjectionMatrix * vec4(input.position, 1);
    output.normal = (model.normalMatrix * vec4(input.normal,0)).xyz;
    output.vertPositionView = (model.modelViewMatrix * vec4(input.position, 1)).xyz;
    return output;
}
