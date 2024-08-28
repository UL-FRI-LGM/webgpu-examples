struct CameraUniforms {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
}

struct ModelUniforms {
    modelMatrix: mat4x4f,
    normalMatrix: mat3x3f,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;

@vertex
fn vertex(@location(0) position: vec4f) -> @builtin(position) vec4f {
    return
        camera.projectionMatrix *
        camera.viewMatrix *
        model.modelMatrix *
        position;
}
