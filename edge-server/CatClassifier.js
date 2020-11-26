const tf = require('@tensorflow/tfjs')

const BaseClassifier = require('./BaseClassifier')

const NUMBER_OF_CHANNELS = 3

class CatClassifier extends BaseClassifier {
  /*   
   * @param mode - detect or classify model
   */
  constructor({ modelPath, labels }) {
    super()
    this.modelPath = modelPath
    this.labels = labels
  }

  async load() {
    const model = await tf.loadGraphModel(this.modelPath, {
      strict: false,
    })
    // model.summary()
    this.model = model
  }

  async classifyFromImage(image) {
    let input = this.imageToInput(image, NUMBER_OF_CHANNELS)
    input = tf.image.resizeNearestNeighbor(input, [150, 150])
    input = input.expandDims(0).div(255.0)
    return this.classifyFromInput(input)
  }

  async classifyFromInput(input) {
    const output = await this.model.executeAsync(input)
    output.print()
    const prediction = output.argMax(1).dataSync()
    const labelIndex = prediction[0]
    const score = output.dataSync()[labelIndex]
    tf.dispose(input)
    return { class: this.labels[labelIndex], score }
  }
}

module.exports = CatClassifier
