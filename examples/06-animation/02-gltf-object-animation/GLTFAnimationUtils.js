import { Animation } from './Animation.js';
import { Transform } from 'engine/core/core.js';

function loadAnimationSampler(loader, sampler) {
    const keyframes = [];
    const values = [];

    const keyframeAccessor = loader.loadAccessor(sampler.input);
    const interpolation = sampler.interpolation ?? 'LINEAR';
    const valuesAccessor = loader.loadAccessor(sampler.output);

    for (let i = 0; i < keyframeAccessor.count; i++) {
        keyframes.push(...keyframeAccessor.get(i));
        values.push(valuesAccessor.get(i));
    }
    return { keyframes, values, interpolation };
}

function loadAnimationChannel(channel, samplers, scene) {
    const target = channel.target;
    if (target.node === undefined) {
        return;
    }

    const entity = scene[target.node];
    const transform = entity.getComponentOfType(Transform);
    const sampler = samplers[channel.sampler];

    const animation = new Animation({
        transform,
        type: target.path,
        interpolation: sampler.interpolation,
        keyframes: sampler.keyframes,
        values: sampler.values,
        fps: 1
    });
    entity.addComponent(animation);
}

function loadAnimation(loader, gltfSpec, scene) {
    if (loader.cache.has(gltfSpec)) {
        return loader.cache.get(gltfSpec);
    }

    if (gltfSpec.channels === undefined || gltfSpec.samplers === undefined) {
        return null;
    }

    const samplers = gltfSpec.samplers.map(s => loadAnimationSampler(loader, s));

    for (const channel of gltfSpec.channels) {
        loadAnimationChannel(channel, samplers, scene);
    }
}

export function loadAnimations(loader, scene) {
    for (const animation of loader.gltf.animations) {
        loadAnimation(loader, animation, scene);
    }
}