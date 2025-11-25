struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) vertPosition : vec3f,
}

struct FragmentInput {
    @location(0) @interpolate(perspective) normal : vec3f,
    @location(1) @interpolate(perspective) fragPosition: vec3f,
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
    output.normal = (model.normalMatrix * vec4(input.normal,0)).xyz;
    output.vertPosition = (model.modelViewMatrix * vec4(input.position, 1)).xyz;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    var lightColor: vec3f = vec3(1,1,1);
    var lightPos: vec3f = vec3(0,5,0);
    var lightVec: vec3f = normalize(lightPos - input.fragPosition.xyz);

    var n: vec3f = normalize(input.normal);

    var difColor: vec3f = vec3(1,0,1);
    var difIntensity = max(dot(n, lightVec), 0.0);

    var specColor: vec3f = vec3(1,1,1);
    var refVec: vec3f = reflect(-lightVec, n);
    var eyeVec: vec3f = normalize(-input.fragPosition.xyz);
    var specIntensity = pow(max(dot(refVec, eyeVec), 0.0), 20.0);

    var ambient: vec3f = vec3(0.1,0.1,0.1);

    output.color = vec4(ambient + lightColor * difColor * difIntensity + lightColor * specColor * specIntensity ,1);
    return output;
}
