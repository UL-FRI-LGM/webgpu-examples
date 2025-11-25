struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(perspective) color : vec3f,
}

struct FragmentInput {
    @location(0) @interpolate(perspective) color : vec3f,
}


struct FragmentOutput {
    @location(0) color : vec4f,
}

struct ModelUniforms {
    modelViewMatrix : mat4x4f,
    modelViewProjectionMatrix : mat4x4f,
    normalMatrix : mat4x4f,
}

@group(0) @binding(0) var<uniform> model : ModelUniforms;

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = model.modelViewProjectionMatrix * vec4(input.position, 1);

    var normal: vec3f = (model.normalMatrix * vec4(input.normal,0)).xyz;
    var vertPosition: vec4f = model.modelViewMatrix * vec4(input.position, 1);

    var lightColor: vec3f = vec3(1,1,1);
    var lightPos: vec3f = vec3(0,5,0);
    var lightVec: vec3f = normalize(lightPos - vertPosition.xyz);

    var n: vec3f = normalize(normal);

    var difColor: vec3f = vec3(1,0,1);
    var difIntensity = max(dot(n, lightVec), 0.0);

    var specColor: vec3f = vec3(1,1,1);
    var refVec: vec3f = reflect(-lightVec, n);
    var eyeVec: vec3f = normalize(-vertPosition.xyz);
    var specIntensity = pow(max(dot(refVec, eyeVec), 0.0), 20.0);

    var ambient: vec3f = vec3(0.1,0.1,0.1);

    output.color = ambient + lightColor * difColor * difIntensity + lightColor * specColor * specIntensity;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    output.color = vec4(input.color, 1);
    return output;
}
