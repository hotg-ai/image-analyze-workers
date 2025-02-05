import { WorkerCommand, WorkerResponse, BodyPixConfig, BodyPixOperationParams, BodypixFunctionTypes } from "./const";
import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs";
import { BrowserTypes } from "@dannadori/000_WorkerBase";

const ctx: Worker = self as any; // eslint-disable-line no-restricted-globals
let config: BodyPixConfig | null = null;
let model: bodyPix.BodyPix | null;

const load_module = async (config: BodyPixConfig) => {
    if (config.useTFWasmBackend || config.browserType === BrowserTypes.SAFARI) {
        console.log("use wasm backend");
        require("@tensorflow/tfjs-backend-wasm");
        await tf.setBackend("wasm");
    } else {
        console.log("use webgl backend");
        require("@tensorflow/tfjs-backend-webgl");
        await tf.setBackend("webgl");
    }
};

const generateImage = (image: ImageBitmap, prediction: bodyPix.SemanticPersonSegmentation) => {
    // generate maskImage from prediction
    const pixelData = new Uint8ClampedArray(prediction.width * prediction.height * 4);
    for (let rowIndex = 0; rowIndex < prediction.height; rowIndex++) {
        for (let colIndex = 0; colIndex < prediction.width; colIndex++) {
            const seg_offset = rowIndex * prediction.width + colIndex;
            const pix_offset = (rowIndex * prediction.width + colIndex) * 4;
            if (prediction.data[seg_offset] === 0) {
                pixelData[pix_offset] = 0;
                pixelData[pix_offset + 1] = 0;
                pixelData[pix_offset + 2] = 0;
                pixelData[pix_offset + 3] = 0;
            } else {
                pixelData[pix_offset] = 255;
                pixelData[pix_offset + 1] = 255;
                pixelData[pix_offset + 2] = 255;
                pixelData[pix_offset + 3] = 255;
            }
        }
    }
    const maskImage = new ImageData(pixelData, prediction.width, prediction.height);

    // generate maskImage Canvas
    const maskOffscreen = new OffscreenCanvas(prediction.width, prediction.height);
    maskOffscreen.getContext("2d")!.putImageData(maskImage, 0, 0);

    // resize mask Image
    const resizedMaskOffscreen = new OffscreenCanvas(image.width, image.height);
    const ctx = resizedMaskOffscreen.getContext("2d")!;
    ctx.drawImage(maskOffscreen, 0, 0, image.width, image.height);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return resizedMaskOffscreen;
};

const predict = async (config: BodyPixConfig, params: BodyPixOperationParams, data: Uint8ClampedArray) => {
    const image = new ImageData(data, params.processWidth, params.processHeight);
    let prediction;
    if (params.type === BodypixFunctionTypes.SegmentPerson) {
        prediction = await model!.segmentPerson(image, params.segmentPersonParams);
    } else if (params.type === BodypixFunctionTypes.SegmentPersonParts) {
        prediction = await model!.segmentPersonParts(image, params.segmentPersonPartsParams);
    } else if (params.type === BodypixFunctionTypes.SegmentMultiPerson) {
        prediction = await model!.segmentMultiPerson(image, params.segmentMultiPersonParams);
    } else if (params.type === BodypixFunctionTypes.SegmentMultiPersonParts) {
        prediction = await model!.segmentMultiPersonParts(image, params.segmentMultiPersonPartsParams);
    } else {
        // segmentPersonに倒す
        prediction = await model!.segmentPerson(image, params.segmentPersonParams);
    }
    return prediction;
};

onmessage = async (event) => {
    if (event.data.message === WorkerCommand.INITIALIZE) {
        config = event.data.config as BodyPixConfig;
        await load_module(config);
        bodyPix.load(event.data.config.model).then((res) => {
            console.log("bodypix loaded default", event.data.config);
            model = res;
            ctx.postMessage({ message: WorkerResponse.INITIALIZED });
        });
    } else if (event.data.message === WorkerCommand.PREDICT) {
        const params: BodyPixOperationParams = event.data.params;
        const data: Uint8ClampedArray = event.data.data;

        const prediction = await predict(config!, params, data);
        ctx.postMessage({
            message: WorkerResponse.PREDICTED,
            prediction: prediction,
        });
    }
};
