const tf = require('@tensorflow/tfjs')

const mobilenet = require('@tensorflow-models/mobilenet')
const cocossd = require('@tensorflow-models/coco-ssd')

const fs = require('fs')
const jpeg = require('jpeg-js')
const flatMap = require('flatmap')

const BaseClassifier = require('./BaseClassifier')
const Bag = require('./util/Bag')

const NUMBER_OF_CHANNELS = 3

class ImageClassifier extends BaseClassifier {
  /*   
   * @param mode - detect or classify model
   */
  constructor({ mode, trackingTags, threshold }) {
    super()
    let model = null
    if (mode === 'detect') {
      model = cocossd
    } else if (mode === 'classify') {
      model = mobilenet
    } else {
      throw new Error('Unknow classifier mode')
    }
    this.unloadedModel = model
    this.mode = mode
    this.trackingTags = trackingTags
    this.threshold = threshold
  }

  async load() {
    const model = await this.unloadedModel.load()
    this.model = model
  }

  mapPredictions(predictions) {
    return flatMap(predictions, (prediction) => {
      if (this.mode === 'detect') {
        return prediction
      }
      // this.mode === 'classify' 
      const classes = prediction.className.split(', ')
      return classes.map(clss => ({
        score: prediction.probability,
        class: clss
      }))
    })
  }

  groupClasses(predictions) {
    const trackingSet = new Set(this.trackingTags)
    const all = new Bag()
    predictions.forEach((prediction) => {
      if (prediction.score >= this.threshold) {
        all.add(prediction.class)
      }
    })
    const classes = all.toArray()
    const countClasses = all.toObject()
    const trackedClasses = classes.filter(x => trackingSet.has(x))
    return {
      classes,
      trackedClasses,
      countClasses,
    }
  }

  async classifyFromImage(image) {
    const input = this.imageToInput(image, NUMBER_OF_CHANNELS)
    return this.classifyFromInput(input)
  }

  async classifyFromInput(input) {
    let predictions
    if (this.mode === 'detect') {
      predictions = await this.model.detect(input)
    } else {
      predictions = await this.model.classify(input)
    }
    tf.dispose(input)
    return this.mapPredictions(predictions)
  }
}

module.exports = ImageClassifier
