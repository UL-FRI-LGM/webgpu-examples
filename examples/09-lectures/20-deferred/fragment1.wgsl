
struct FragmentInput {
    @builtin(position) fragPosition: vec4f,
    @location(0) normal: vec3f,
    @location(1) fragPositionWorld: vec3f,
}

struct FragmentOutput {
    @location(0) color : vec4f,
    @location(1) positionWorld : vec4f,
    @location(2) normalWorld : vec4f,
}

@fragment
fn main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;

    output.color = vec4f(input.fragPosition.x/1600, input.fragPosition.y/1200,input.fragPosition.z,1);
    output.positionWorld = vec4(input.fragPositionWorld,1);
    output.normalWorld = vec4(normalize(input.normal), 0);

    return output;
}

