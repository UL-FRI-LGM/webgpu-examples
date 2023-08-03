export function createTextureFromSource(device, {
    source,
    format = 'rgba8unorm',
    usage = 0,
    mipLevelCount = 1,
    flipY = false,
}) {
    const size = [source.width, source.height];
    const texture = device.createTexture({
        format,
        size,
        mipLevelCount,
        usage: usage |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
        { source, flipY },
        { texture },
        size,
    );
    return texture;
}
