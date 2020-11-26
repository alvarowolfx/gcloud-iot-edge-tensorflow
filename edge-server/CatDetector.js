const tf = require('@tensorflow/tfjs')
const jpeg = require('jpeg-js')
const fs = require('fs')

const BaseClassifier = require('./BaseClassifier')
const CatClassifier = require('./CatClassifier')
const ImageClassifier = require('./ImageClassifier')

class CatDetector extends BaseClassifier {

  constructor({ modelPath, labels, threshold, trackingTags }) {
    super()
    const mode = 'detect'
    this.classifier = new CatClassifier({ labels, modelPath })
    this.detector = new ImageClassifier({ mode, threshold, trackingTags })
    this.groupClasses = this.detector.groupClasses.bind(this.detector)
  }

  async load() {
    await this.classifier.load()
    await this.detector.load()
  }

  saveImage(tensor, path) {
    const [batch, height, width, channels] = tensor.shape
    //create an Image data var   
    const buffer = Buffer.alloc(width * height * 4)
    //get the tensor values as data
    const data = tensor.dataSync()
    //map the values to the buffer  
    let i = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = (y * width + x) * 4      // position in buffer based on x and y
        buffer[pos] = data[i]             // some R value [0, 255]
        buffer[pos + 1] = data[i + 1]           // some G value
        buffer[pos + 2] = data[i + 2]           // some B value
        buffer[pos + 3] = 255            // set alpha channel
        i += 3
      }
    }

    const rawImageData = {
      data: buffer,
      width: width,
      height: height
    };
    const jpegImageData = jpeg.encode(rawImageData, 50)
    fs.writeFile(path, jpegImageData.data, err => {

    })
  }


  async classifyFromImage(image) {
    const input = this.classifier.imageToInput(image, 3)
    const objects = await this.detector.classifyFromImage(image)

    //console.log(objects)

    const classifyInput = input
      .asType('float32')
      .expandDims(0)

    const [height, width, channels] = input.shape

    const promises = objects
      .filter(obj => obj.class === 'cat')
      .map(async (obj, i) => {
        const [x1, y1, w, h] = obj.bbox
        const y2 = (y1 + h) / height
        const x2 = (x1 + w) / width
        const box = [[y1 / height, x1 / width, y2, x2]]
        const crop = tf.image.cropAndResize(classifyInput, box, [0], [h, w])

        const result = await this.classifier.classifyFromInput(crop.div(255.0))
        //console.log(result)
        objects.push(result)
        this.saveImage(crop, `test_${i}.jpeg`)
      })
    await Promise.all(promises)
    tf.dispose(input)
    return objects
  }
}

module.exports = CatDetector
