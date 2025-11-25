import { quat, vec3 } from 'glm';


export class Animation {
    constructor({
        transform,
        type,
        interpolation = "LINEAR",
        keyframes = [],
        values = [],
        loops = false,
        fps = 24,
    }) {
        this.transform = transform ?? null;
        this.type = type ?? null;
        this.interpolation = interpolation;
        this.keyframes = keyframes;
        this.values = values;
        this.loops = loops;
        this.fps = fps;
    }

    update(time, dt) {
        if (
            this.keyframes.length === 0 ||
            this.transform === null ||
            this.type === null
        ) {
            return;
        }

        let lastKeyframe = this.keyframes[this.keyframes.length - 1];
        let absoluteFrames = time * this.fps;
        let currentFrame = absoluteFrames % lastKeyframe;

        let prevKeyframeIndex = 0;
        let nextKeyframeIndex = 0;
        for (let i = 0; i < this.keyframes.length; i++) {
            if (this.keyframes[i] > currentFrame) {
                nextKeyframeIndex = i;
                if (i - 1 >= 0) {
                    prevKeyframeIndex = i - 1;
                }
            }
        }
        let prevKeyframe = this.keyframes[prevKeyframeIndex];
        let nextKeyframe = this.keyframes[nextKeyframeIndex];
        
        let prevValue = this.values[prevKeyframeIndex];
        let nextValue = this.values[nextKeyframeIndex];

        let t = (currentFrame - prevKeyframe) / (nextKeyframe - prevKeyframe);

        if (this.interpolation === 'LINEAR') {
            switch (this.type) {
                case 'translation':
                    vec3.lerp(this.transform.translation, prevValue, nextValue, t);
                    break;
                case 'rotation':
                    quat.slerp(this.transform.rotation, prevValue, nextValue, t);
                    break;
                case 'scale':
                    vec3.lerp(this.transform.scale, prevValue, nextValue, t);
                    break;
            }
        }
    }
}