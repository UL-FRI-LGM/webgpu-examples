export class Light {

    constructor({
        resolution = [512, 512],
        decalTexture,
    } = {}) {
        this.resolution = resolution;
        this.decalTexture = decalTexture;
    }

}
