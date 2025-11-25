@group(0) @binding(0) var gBufferAlbedo: texture_2d<f32>;
@group(0) @binding(1) var gBufferPosWorld: texture_2d<f32>;
@group(0) @binding(2) var gBufferNormal: texture_2d<f32>;


fn lighting(posWorld: vec3f, normal: vec3f, albedo: vec4f) -> vec3f {
    const maxDistance = 0.6;
    var lvis = 0.0;
    var svis = 0.0;
    for (var i: f32 = -5; i < 5; i+=1) {
        for (var j: f32 = -1.8; j < 1.2; j+=maxDistance) {
            for (var k: f32 = -12; k < 0; k+=maxDistance) {
                let lightPos = vec3<f32>(i, j, k);
                let dist = distance(lightPos, posWorld);
                if (dist > maxDistance) {
                    continue;
                }
                let lightDir = normalize(lightPos - posWorld);
                let lambertFactor = max(dot(lightDir, normal), 0.0) * pow(2*maxDistance-2*dist,2);
                lvis += lambertFactor;
                let e = normalize(-posWorld);
                let r = reflect(-lightDir, normal);
                let s = pow(max(dot(r, e), 0.0), 30.0) * pow(2*maxDistance-2*dist,2);
                svis += s;
            }
        }
    }
    let color = vec3(0.1, 0.1, 0.1) + albedo.xyz * (vec3(1,1,1) * lvis) + vec3(1,1,1) * svis;
    return color;
}

@fragment
fn main(@builtin(position) coord : vec4f) -> @location(0) vec4f {

    let loc = vec2i(floor(coord.xy));
    let albedo = textureLoad(gBufferAlbedo, loc, 0);
    let posWorld = textureLoad(gBufferPosWorld, loc, 0).xyz;
    let normal = normalize(textureLoad(gBufferNormal, loc, 0).xyz);


    if (coord.z >= 1.0) { // don't calculate for background
      discard;
    }

    return vec4(lighting(posWorld, normal, albedo), 1);
}

