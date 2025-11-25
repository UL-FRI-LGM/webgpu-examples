function parseAnimationSampler(gltfSpec) {

}

function parseAnimationChannel(gltfSpec, scene) {
    const keyframes = [];
    const values = [];

    const target = channel.target;
    if (target.node === undefined) {
        return;
    }
    
    const entity = scene[target.node];
    const transform = entity.getComponentOfType(Transform);
    
    const sampler = gltfSpec.samplers[channel.sampler];
    const keyframeAccessor = loader.loadAccessor(sampler.input);
    const interpolation = sampler.interpolation ?? 'LINEAR';
    const valuesAccessor = loader.loadAccessor(sampler.output);

    for (let i = 0; i < keyframeAccessor.count; i++) {
        keyframes.push(...keyframeAccessor.get(i));
        values.push(valuesAccessor.get(i));
    }

    const animation = new Animation({
        transform,
        type: target.path,
        interpolation,
        keyframes,
        values,
        fps: 1
    });
    entity.addComponent(animation);
}

export function parseAnimation(gltfSpec, scene) {
    if (loader.cache.has(gltfSpec)) {
        return loader.cache.get(gltfSpec);
    }

    if (gltfSpec.channels === undefined || gltfSpec.samplers === undefined) {
        return null;
    }

    for (const channel of gltfSpec.channels) {
        parseAnimationChannel(channel, scene);
    }
}