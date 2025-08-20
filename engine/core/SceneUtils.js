import { mat4 } from 'glm';

import { Camera } from './Camera.js';
import { Model } from './Model.js';
import { Parent } from './Parent.js';
import { Transform } from './Transform.js';

export function getLocalModelMatrix(entity) {
    const matrix = mat4.create();
    for (const transform of entity.getComponentsOfType(Transform)) {
        matrix.multiply(transform.matrix);
    }
    return matrix;
}

export function getGlobalModelMatrix(entity) {
    const parent = entity.getComponentOfType(Parent)?.entity;
    if (parent) {
        const parentMatrix = getGlobalModelMatrix(parent);
        const modelMatrix = getLocalModelMatrix(entity);
        return parentMatrix.multiply(modelMatrix);
    } else {
        return getLocalModelMatrix(entity);
    }
}

export function getLocalViewMatrix(entity) {
    return getLocalModelMatrix(entity).invert();
}

export function getGlobalViewMatrix(entity) {
    return getGlobalModelMatrix(entity).invert();
}

export function getProjectionMatrix(entity) {
    return entity.getComponentOfType(Camera)?.projectionMatrix ?? mat4.create();
}
