require('@tensorflow/tfjs-node')
const tf = require('@tensorflow/tfjs')
const jpeg = require('jpeg-js')
const fs = require('fs')

const CatClassifier = require('./CatClassifier')
const ImageClassifier = require('./ImageClassifier')

function saveImage(tensor, path) {
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

async function main() {
  try {
    const labels = { 0: 'berry', 1: 'jam', 2: 'muffin', 3: 'popcorn', 4: 'raspberry' }
    const modelPath = 'file://../custom_model/tfjs-models/model.json'
    const classifier = new CatClassifier({ labels, modelPath })
    await classifier.load()

    const trackingTags = ['cat']
    const threshold = 0.6
    const mode = 'detect'
    const detector = new ImageClassifier({ mode, threshold, trackingTags })
    await detector.load()
    console.log("Loaded")

    const index = Math.floor((Math.random() * 9) + 1)
    const catIndex = Math.floor((Math.random() * 4))
    const cat = Object.values(labels)[catIndex]
    //const path = `../custom_model/output/${cat}/${index}.jpg`
    //const path = '../custom_model/images/cat00005.jpg'
    const path = './test_3.jpeg'
    console.log(`Reading image ${path}`)

    const result = await classifier.classifyFromFile(path)
    console.log(result)

    return;

    const image = classifier.readImage(path)
    const input = classifier.imageToInput(image, 3)

    const objects = await detector.classifyFromFile(path)
    console.log(objects)

    const classifyInput = input
      .asType('float32')
      .expandDims(0)

    const [height, width, channels] = input.shape

    objects
      .filter(obj => obj.class === 'cat')
      .forEach(async (obj, i) => {
        const [x1, y1, w, h] = obj.bbox
        const y2 = (y1 + h) / height
        const x2 = (x1 + w) / width
        const box = [[y1 / height, x1 / width, y2, x2]]
        const crop = tf.image.cropAndResize(classifyInput, box, [0], [h, w])

        const result = await classifier.classifyFromInput(crop.div(255.0))
        console.log(result)
        saveImage(crop, `test_${i}.jpeg`)
      })

  } catch (e) {
    console.error(e)
  }
}

main()
