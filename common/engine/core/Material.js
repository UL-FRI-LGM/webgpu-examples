export class Material {

    constructor({
        base,
        emission,
        normal,
        occlusion,
        roughness,
        metalness,

        baseFactor = [1, 1, 1, 1],
        emissionFactor = [0, 0, 0],
        normalFactor = 1,
        occlusionFactor = 1,
        roughnessFactor = 1,
        metalnessFactor = 1,
    } = {}) {
        this.base = base;
        this.emission = emission;
        this.normal = normal;
        this.occlusion = occlusion;
        this.roughness = roughness;
        this.metalness = metalness;

        this.baseFactor = baseFactor;
        this.emissionFactor = emissionFactor;
        this.normalFactor = normalFactor;
        this.occlusionFactor = occlusionFactor;
        this.roughnessFactor = roughnessFactor;
        this.metalnessFactor = metalnessFactor;
    }

}
