const tf = require('@tensorflow/tfjs')

const fs = require('fs')
const jpeg = require('jpeg-js')

class BaseClassifier {

  readImage(path) {
    const buf = fs.readFileSync(path)
    const pixels = jpeg.decode(buf, true)
    return pixels
  }

  imageByteArray(image, numChannels) {
    const pixels = image.data
    const numPixels = image.width * image.height
    const values = new Int32Array(numPixels * numChannels)

    for (let i = 0; i < numPixels; i++) {
      for (let channel = 0; channel < numChannels; ++channel) {
        values[i * numChannels + channel] = pixels[i * 4 + channel]
      }
    }

    return values
  }

  imageToInput(image, numChannels) {
    const values = this.imageByteArray(image, numChannels)
    const outShape = [image.height, image.width, numChannels]
    const input = tf.tensor3d(values, outShape, 'int32')

    return input
  }

  async classifyFromFile(path) {
    const image = this.readImage(path)
    return this.classifyFromImage(image)
  }

  async classifyFromImage(image) {
    throw new Error('Not implemented')
  }
}

module.exports = BaseClassifier
