struct VertexInput {
    @location(0) position : vec3f,
    @location(1) normal : vec3f,
    @location(2) texcoords : vec2f,
}

struct VertexOutput {
    @builtin(position) position : vec4f,
    @location(0) texcoords : vec2f,
    @location(1) @interpolate(perspective) normal : vec3f,
    @location(2) @interpolate(perspective) vertPosition : vec4f,
}

struct FragmentInput {
    @location(0) texcoords : vec2f,
    @location(1) @interpolate(perspective) normal : vec3f,
    @location(2) @interpolate(perspective) fragPosition: vec4f,
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
@group(0) @binding(1) var uTexture : texture_2d<f32>;
@group(0) @binding(2) var uSampler : sampler;
@group(0) @binding(3) var nTexture : texture_2d<f32>;
@group(0) @binding(4) var nSampler : sampler;

// http://www.thetenthplanet.de/archives/1180
fn cotangent_frame(N: vec3f, p: vec3f, uv: vec2f) -> mat3x3f {
    // get edge vectors of the pixel triangle
    var dp1: vec3f = dpdxFine( p );
    var dp2: vec3f = dpdyFine( p );
    var duv1: vec2f = dpdxFine( uv );
    var duv2: vec2f = dpdyFine( uv );

    // solve the linear system
    var dp2perp: vec3f = cross( dp2, N );
    var dp1perp: vec3f = cross( N, dp1 );
    var T: vec3f = dp2perp * duv1.x + dp1perp * duv2.x;
    var B: vec3f = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    var invmax = inverseSqrt( max( dot(T,T), dot(B,B) ) );
    return mat3x3f( T * invmax, B * invmax, N );
}

@vertex
fn vertex(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = model.modelViewProjectionMatrix * vec4(input.position, 1);
    output.normal = (model.normalMatrix * vec4(input.normal,0)).xyz;
    output.vertPosition = model.modelViewMatrix * vec4(input.position, 1);
    output.texcoords = input.texcoords;
    return output;
}

@fragment
fn fragment(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    var lightColor: vec3f = vec3(1,1,1);
    var lightPos: vec3f = vec3(0,5,0);
    var lightVec: vec3f = normalize(lightPos - input.fragPosition.xyz);

    var n: vec3f = normalize(input.normal);
    var eyeVec: vec3f = normalize(-input.fragPosition.xyz);

    var normal: vec3f = textureSample(nTexture, nSampler, input.texcoords).xyz;
    normal = normal * 255./127. - 128./127.;
    var TBN: mat3x3f = cotangent_frame(n, -eyeVec, input.texcoords);
    n = normalize(TBN * normal);

    var difColor: vec3f = textureSample(uTexture, uSampler, input.texcoords).xyz;
    var difIntensity = max(dot(n, lightVec), 0.0);

    var specColor: vec3f = vec3(1,1,1);
    var refVec: vec3f = reflect(-lightVec, n);
    var specIntensity = pow(max(dot(refVec, eyeVec), 0.0), 20.0);

    var ambient: vec3f = vec3(0.01,0.01,0.01);

    output.color = vec4(ambient + lightColor * difColor * difIntensity + lightColor * specColor * specIntensity ,1);

    return output;
}
