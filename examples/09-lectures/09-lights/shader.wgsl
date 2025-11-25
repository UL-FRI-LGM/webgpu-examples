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

struct LightParameters {
    color: vec3f,
    lightVec: vec3f,
}

fn getLight(pos: vec3f, lightType: i32) -> LightParameters {
    var lightColor: vec3f = vec3(1,1,1);
    var lightPos: vec3f = vec3(0,5,0);
    var lightDir: vec3f = normalize(vec3(0,-1,-1));

    var lp: LightParameters;
    lp.color = lightColor;

    if (lightType == 0) // directional
    {
        lp.lightVec = -lightDir;
    }
    else if (lightType == 1) // point
    {
        lp.lightVec = normalize(lightPos - pos);
        lp.color = lp.color / max(1,min(100, pow(length(lightPos - pos)/10,1)));
    }
    else if (lightType == 2) // spot
    {
        lp.lightVec = normalize(lightPos - pos);
        var cone = max(0,dot(-lp.lightVec, lightDir));
        if (cone > cos(3.1415/10))
        {
            lp.color = lp.color * pow(cone, 1000);
        }
        else
        {
            lp.color = vec3(0,0,0);
        }
    }
    return lp;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    var light: LightParameters = getLight(input.fragPosition, 2); // 0 = directional, 1 = point, 2 = spot

    var n: vec3f = normalize(input.normal);

    var difColor: vec3f = vec3(1,0,1);
    var difIntensity = max(dot(n, light.lightVec), 0.0);

    var specColor: vec3f = vec3(1,1,1);
    var refVec: vec3f = reflect(-light.lightVec, n);
    var eyeVec: vec3f = normalize(-input.fragPosition);
    var specIntensity = pow(max(dot(refVec, eyeVec), 0.0), 20.0);

    var ambient: vec3f = vec3(0.1,0.1,0.1);

    output.color = vec4(ambient + light.color * difColor * difIntensity + light.color * specColor * specIntensity ,1);
    return output;
}
