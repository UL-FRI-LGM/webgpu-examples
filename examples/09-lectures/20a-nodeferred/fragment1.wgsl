
struct FragmentInput {
    @builtin(position) fragPosition: vec4f,
    @location(0) normal: vec3f,
    @location(1) fragPositionWorld: vec3f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
}

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
fn main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    let albedo = vec4f(input.fragPosition.x/1600, input.fragPosition.y/1200,input.fragPosition.z,1);
    let c: vec3f = lighting(input.fragPositionWorld, normalize(input.normal), albedo);

    output.color = vec4f(c,1);
    return output;
}

