export function createBufferFromArrayBuffer(device, { source, usage }) {
    const buffer = device.createBuffer({
        size: Math.ceil(source.byteLength / 4) * 4,
        mappedAtCreation: true,
        usage,
    });
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(source));
    buffer.unmap();
    return buffer;
}
