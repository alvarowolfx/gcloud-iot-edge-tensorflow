const mobilenet = require( '@tensorflow-models/mobilenet' )
const cocossd = require( '@tensorflow-models/coco-ssd' )

const DeviceListener = require( './DeviceListener' )
const ImageClassifier = require( './ImageClassifier' )

class EdgeServer {
  constructor( config ) {
    if ( config.mode === 'detect' ) {
      this.classifier = new ImageClassifier( cocossd, config.mode )
    } else if ( config.mode === 'classify' ) {
      this.classifier = new ImageClassifier( mobilenet, 'classify' )
    } else {
      throw new Error( 'Unknow classifier mode' )
    }
    this.deviceListener = new DeviceListener()
    this.config = config
  }

  async start() {
    await this.classifier.load()
    this.deviceListener.start()

    // this.ticker = setInterval( this.run.bind( this ), 10000 )
    this.run()
  }

  async run() {
    const devices = this.deviceListener.getDevices()
    const promises = devices.map( async ( device ) => {
      console.log( 'Looking for image from ', device.name )
      try {
        const image = await device.fetchImage()        
        console.log( 'Fetched image from ', device.name )
        // console.timeEnd( `FetchImage-${device.name}` )
        // console.time( `ClassifyImage-${device.name}` )
        const predictions = await this.classifier.classifyFromImage( image )              
        // console.timeEnd( `ClassifyImage-${device.name}` )
        const { classes, trackedClasses } = this.filterClasses( predictions )        
        console.log( 'Found classes', device.name, classes )
        if ( trackedClasses.length > 0 ) {
          console.log( 'Found tracking target on device', device.name, trackedClasses )
          // Do something with data
        }
      } catch ( e ) {
        console.error( 'Error fetching image from device', device.name, e.message )        
      }
    } )

    await Promise.all( promises )
    if ( !this.stoppped ) {
      setTimeout( this.run.bind( this ), 100 )
    }
  } 
  
  filterClasses( predictions ) {
    const trackingSet = new Set( this.config.trackingTags )
    const all = new Set()
    predictions.forEach( ( prediction ) => {          
      if ( this.config.mode === 'detect' ) {
        if ( prediction.score >= this.config.threshold ) {
          all.add( prediction.class )
        }
      } else if ( this.config.mode === 'classify' ) { 
        if ( prediction.probability >= this.config.threshold ) {             
          prediction.className.split( ', ' ).forEach( all.add )            
        }
      }
          
    } )
    const classes = [ ...all ]
    const trackedClasses = classes.filter( x => trackingSet.has( x ) )
    return { 
      classes,
      trackedClasses
    }
  }

  stop() {
    this.ticker && this.ticker()
    this.stopped = true
    this.deviceListener.stop()
  }
}

module.exports = EdgeServer
