const tf = require( '@tensorflow/tfjs' )

const fs = require( 'fs' )
const jpeg = require( 'jpeg-js' )

const NUMBER_OF_CHANNELS = 3

class ImageClassifier {
  /*
   * 
   * @param model - tf model
   * @param mode - detect or classify model
   */
  constructor( model, mode ) {
    this.unloadedModel = model
    this.mode = mode
  }

  async load() {
    const model = await this.unloadedModel.load( )
    this.model = model
  }


  readImage( path ) {
    const buf = fs.readFileSync( path )
    const pixels = jpeg.decode( buf, true )
    return pixels
  }

  imageByteArray( image, numChannels ) {
    const pixels = image.data
    const numPixels = image.width * image.height;
    const values = new Int32Array( numPixels * numChannels );

    for ( let i = 0; i < numPixels; i++ ) {
      for ( let channel = 0; channel < numChannels; ++channel ) {
        values[i * numChannels + channel] = pixels[i * 4 + channel];
      }
    }

    return values
  }

  imageToInput( image, numChannels ) {
    const values = this.imageByteArray( image, numChannels )
    const outShape = [ image.height, image.width, numChannels ];
    const input = tf.tensor3d( values, outShape, 'int32' );

    return input
  }

  async classifyFromFile( path ) {  
    const image = this.readImage( path )
    return this.classifyFromImage( image )
  }

  async classifyFromImage( image ) {  
    const input = this.imageToInput( image, NUMBER_OF_CHANNELS )        
    let predictions;
    if ( this.mode === 'detect' ) {
      predictions = await this.model.detect( input )
    } else {
      predictions = await this.model.classify( input )
    }
    tf.dispose( input )
    return predictions
  }
}

module.exports = ImageClassifier
