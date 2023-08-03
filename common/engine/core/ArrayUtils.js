export function numberOfAttributesInArray(array, strideInElements = 0, offsetInElements = 0, numberOfElements = 0) {
    return Math.floor((array.length - offsetInElements + strideInElements - numberOfElements) / strideInElements);
}

export function copyAttributes(attributes = [], { firstVertex = 0, vertexCount } = {}) {
    let maxNumberOfAttributes = 0;
    for (const {
        inputArray,
        inputOffsetInElements = 0,
        inputStrideInElements = 0,

        outputArray,
        outputOffsetInElements = 0,
        outputStrideInElements = 0,

        numberOfComponents = 1,
    } of attributes) {
        const inputAttributes = numberOfAttributesInArray(
            inputArray, inputStrideInElements, inputOffsetInElements, numberOfComponents);
        const outputAttributes = numberOfAttributesInArray(
            outputArray, outputStrideInElements, outputOffsetInElements, numberOfComponents);
        const numberOfAttributes = Math.min(inputAttributes, outputAttributes);
        maxNumberOfAttributes = Math.max(maxNumberOfAttributes, numberOfAttributes);
    }

    vertexCount ??= Math.max(0, maxNumberOfAttributes - firstVertex);

    const lastVertex = firstVertex + vertexCount;
    for (let vertex = firstVertex; vertex < lastVertex; vertex++) {
        for (const {
            inputArray,
            inputOffsetInElements = 0,
            inputStrideInElements = 0,

            outputArray,
            outputOffsetInElements = 0,
            outputStrideInElements = 0,

            numberOfComponents = 1,
            convert = x => x,
        } of attributes) {
            for (let component = 0; component < numberOfComponents; component++) {
                outputArray[outputOffsetInElements + outputStrideInElements * vertex + component] =
                    convert(inputArray[inputOffsetInElements + inputStrideInElements * vertex + component]);
            }
        }
    }
}

export function createArrayBufferFromLayout(attributes, layout) {
    // calculate the number of attributes in each array, choose max
    let maxNumberOfAttributes = 0;
    for (const attribute in layout) {
        const { components } = layout[attribute];
        const array = attributes[attribute];
        const numberOfAttributes = Math.floor(array.length / components);
        maxNumberOfAttributes = Math.max(maxNumberOfAttributes, numberOfAttributes);
    }

    // calculate array length for each attribute for the above number of attributes, choose max
    let maxArrayLength = 0;
    for (const attribute in layout) {
        const { view, components = 1, stride, offset = 0 } = layout[attribute];
        const attributeSize = view.BYTES_PER_ELEMENT * components;
        const arrayLength = offset + (maxNumberOfAttributes - 1) * stride + attributeSize;
        maxArrayLength = Math.max(maxArrayLength, arrayLength);
    }

    const outputArray = new ArrayBuffer(maxArrayLength);

    const attributeSettings = [];
    for (const attribute in layout) {
        const { view, components, stride, offset, convert } = layout[attribute];
        attributeSettings.push({
            inputArray: attributes[attribute],
            inputStrideInElements: components,

            outputArray: new view(outputArray, offset),
            outputStrideInElements: stride / view.BYTES_PER_ELEMENT,

            numberOfComponents: components,
            convert: convert,
        });
    }

    copyAttributes(attributeSettings, {
        vertexCount: maxNumberOfAttributes,
    });

    return outputArray;
}
