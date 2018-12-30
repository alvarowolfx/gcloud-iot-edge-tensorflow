const { RateLimiter } = require( 'limiter' )

const DeviceListener = require( './DeviceListener' )
const ImageClassifier = require( './ImageClassifier' )
const CloudIoTCoreGateway = require( './CloudIoTCoreGateway' )
const WebInterface = require( './WebInterface' )

class EdgeServer {
  constructor( config ) {
    const { classifier, web, gateway } = config
    
    this.deviceListener = new DeviceListener()
    this.classifier = new ImageClassifier( classifier )
    this.gateway = new CloudIoTCoreGateway( gateway )
    this.web = new WebInterface( web )      
    this.limiter = new RateLimiter( 2, 'minute' )

    this.deviceQueue = {}
  }

  async start() {
    this.stopped = false
    await this.classifier.load()
    this.deviceListener.start()
    this.web.start()
    this.gateway.start()

    this.deviceListener.onDeviceAdded( ( deviceId ) => {
      this.gateway.attachDevice( deviceId )
      this.gateway.publishDeviceState( deviceId, { status : 'online' } )
    } )

    this.deviceListener.onDeviceRemoved( ( deviceId ) => {
      this.gateway.dettachDevice( deviceId )
      this.gateway.publishDeviceState( deviceId, { status : 'offline' } )
    } )

    this.run()    
    // this.ticker = setInterval( this.run.bind( this ), 10000 )
    
    await this.gateway.publishGatewayState( { status : 'online' } )
  }

  hasData() {
    return Object.keys( this.deviceQueue ).length > 0 
  }

  queueData( device, { classes, trackedClasses, countClasses } ) { 
    if ( classes.length === 0 ) {
      return
    }       

    const { name } = device
    const deviceData = this.deviceQueue[name]
    if ( !deviceData ) {
      this.deviceQueue[name] = {
        name,
        classes, 
        trackedClasses,
        countClasses
      }      
    } else {      
      const classesSet = new Set( deviceData.classes.concat( classes ) )
      const nClasses = [ ...classesSet ]

      const trackedClassesSet = new Set( deviceData.trackedClasses.concat( trackedClasses ) )
      const nTrackedClasses = [ ...trackedClassesSet ]

      const nCountClasses = {
        ...deviceData.countClasses,
        ...countClasses
      }
      Object.keys( nCountClasses ).forEach( ( key ) => {
        nCountClasses[key] = Math.max( deviceData.countClasses[key], countClasses[key] )
      } )

      this.deviceQueue[name] = {
        name,
        classes : nClasses, 
        trackedClasses : nTrackedClasses,
        countClasses : nCountClasses
      }  
    }
  }

  clearQueue() {
    this.deviceQueue = {}
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
        
        const result = this.classifier.filterClasses( predictions )
        const { countClasses } = result
        console.log( 'Found classes', device.name, countClasses )
        
        this.queueData( device, result )
      } catch ( e ) {
        console.error( 'Error fetching image from device', device.name, e.message )          
      }
    } )

    // Wait for inference results and filter for valid ones
    await Promise.all( promises )    
    
    // Update local web interface
    this.web.broadcastData( 'devices', Object.values( this.deviceQueue ) )

    // Send data to cloud iot core    
    try {
      if ( this.hasData() ) {
        if ( this.limiter.tryRemoveTokens( 1 ) ) {        
          console.log( '[PublishData] Sending data to cloud iot core.' )
          await Promise.all( 
            Object.keys( this.deviceQueue ).map( ( deviceId ) => {
              const res = this.deviceQueue[deviceId]
              return this.gateway.publishDeviceTelemetry( deviceId, res.countClasses )
            } )    
          )
          this.clearQueue()
        } else {
          console.log( '[PublishData] Publishing throttled.' )
        }
      }
    } catch ( err ) {
      console.error( 'Error sending data to cloud iot core', err )
    }
    
    if ( !this.stopped ) {
      setTimeout( this.run.bind( this ), 100 )
    }
  } 
  
  async stop() {  
    console.log( '[EdgeServer] Closing...' )
    this.stopped = true   
    if ( this.ticker ) {
      clearInterval( this.ticker )
    } 

    const devices = this.deviceListener.getDevices()
    
    this.deviceListener.stop()
    this.web.stop()

    console.log( 'Sending offline events' )
    try {
      await Promise.all(
        devices.map( ( device ) => {
          console.log( 'Sending offline event for device ', device.name )
          return this.gateway.publishDeviceState( device.name, { status : 'offline' } )
        } )
      )

      console.log( 'Sending gateway offline event' )
      await this.gateway.publishGatewayState( { status : 'offline' } )    
      console.log( 'All offline events sent' )
    } catch ( err ) {
      console.error( 'Error sending data to cloud iot core', err )
    }

    this.gateway.stop()
    console.log( '[EdgeServer] Done' )
  }
}

module.exports = EdgeServer
