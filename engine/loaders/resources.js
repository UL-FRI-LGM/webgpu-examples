import { GLTFLoader } from './GLTFLoader.js';
import { ImageLoader } from './ImageLoader.js';
import { JSONLoader } from './JSONLoader.js';
import { OBJLoader } from './OBJLoader.js';

// It would be better to choose a loader based on the MIME type of the HTTP response
const loaderMap = {
    'png': ImageLoader,
    'jpg': ImageLoader,
    'jpeg': ImageLoader,
    'webp': ImageLoader,
    'avif': ImageLoader,
    'gltf': GLTFLoader,
    'json': JSONLoader,
    'obj': OBJLoader,
};

function ext(url) {
    return url.pathname.substring(url.pathname.lastIndexOf('.') + 1);
}

export async function loadResources(resourceMap) {
    const promises = Object.entries(resourceMap)
        .map(async ([name, url]) => [name, await (new loaderMap[ext(url)]).load(url)])
    return Object.fromEntries(await Promise.all(promises));
}
