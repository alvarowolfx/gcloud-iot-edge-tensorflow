const { RateLimiter } = require( 'limiter' )

const DeviceListener = require( './DeviceListener' )
const ImageClassifier = require( './ImageClassifier' )
const CloudIoTCoreGateway = require( './CloudIoTCoreGateway' )
const WebInterface = require( './WebInterface' )

const createLogger = require( './Log' )

const logger = createLogger( 'EdgeServer' )

class EdgeServer {
  constructor( config ) {
    const { classifier, web, gateway } = config
    
    this.deviceListener = new DeviceListener()
    this.classifier = new ImageClassifier( classifier )
    this.gateway = new CloudIoTCoreGateway( gateway )
    this.web = new WebInterface( web )      
    this.limiter = new RateLimiter( 1, 'minute' )

    this.deviceQueue = {}
  }

  async start() {
    this.stopped = false
    await this.classifier.load()
    this.deviceListener.start()
    this.web.start()
    await this.gateway.start()

    this.deviceListener.onDeviceAdded( async ( deviceId ) => {      
      await this.gateway.attachDevice( deviceId )
      this.gateway.publishDeviceState( deviceId, { status : 'online' } )
    } )

    this.deviceListener.onDeviceRemoved( async ( deviceId ) => {      
      this.gateway.publishDeviceState( deviceId, { status : 'offline' } )
      this.gateway.detachDevice( deviceId )
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
      classes = [ 'empty' ] 
      countClasses = { empty : 1 }      
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
        nCountClasses[key] = Math.max( deviceData.countClasses[key], countClasses[key] ) || 1
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
      logger.info( `Looking for image from ${device.name}` )
      try {
        logger.profile( `FetchImage-${device.name}` )
        const image = await device.fetchImage()        
        logger.info( `Fetched image from ${device.name}` )        
        logger.profile( `FetchImage-${device.name}` )        
                
        logger.profile( `ClassifyImage-${device.name}` )
        const predictions = await this.classifier.classifyFromImage( image )
        logger.profile( `ClassifyImage-${device.name}` )
        
        const grouped = this.classifier.groupClasses( predictions )
        const { countClasses } = grouped
        logger.info( `Found classes ${device.name} - ${JSON.stringify( countClasses )}` )
        
        this.queueData( device, grouped )
      } catch ( e ) {
        logger.error( 'Error fetching image from device', device.name, e.message )          
      }
    } )

    // Wait for inference results and filter for valid ones
    try {
      await Promise.all( promises )    
    } catch ( e ) {
      logger.error( 'Error running inference on some devices', e.message )
    }
    
    // Update local web interface
    logger.info( `Device queue : ${JSON.stringify( this.deviceQueue )}` )
    const deviceData = Object.values( this.deviceQueue )      
    this.web.broadcastData( 'devices', deviceData )

    // Send data to cloud iot core    
    try {
      if ( this.hasData() ) {
        if ( this.limiter.tryRemoveTokens( 1 ) ) {        
          logger.info( '[PublishData] Sending data to cloud iot core.' )
          const publishPromises = Object.keys( this.deviceQueue ).map( ( deviceId ) => {
            const res = this.deviceQueue[deviceId]
            // Check if is just empty
            if ( res.countClasses.empty && Object.keys( res.countClasses ).length === 1 ) {
              logger.info( '[Empty] Message ' )
              return this.gateway.publishDeviceTelemetry( deviceId, { classes : {} } )
            } 
            delete res.countClasses.empty
            return this.gateway.publishDeviceTelemetry( deviceId, { classes : res.countClasses } )
          } )              
          await Promise.all( publishPromises )
          this.clearQueue()                    
        } else {
          
          logger.info( '[PublishData] Publishing throttled.' )
        }
      }
    } catch ( err ) {
      logger.error( `Error sending data to cloud iot core ${err}`, err )      
    }
    
    if ( !this.stopped ) {
      setTimeout( this.run.bind( this ), 100 )
    }
  } 
  
  async stop() {  
    logger.info( 'Closing...' )
    this.stopped = true   
    if ( this.ticker ) {      
      clearInterval( this.ticker )
    } 

    const devices = this.deviceListener.getDevices()
    
    this.deviceListener.stop()
    this.web.stop()

    logger.info( 'Sending offline events' )
    try {
      logger.info( 'Sending gateway offline event' )
      await this.gateway.publishGatewayState( { status : 'offline' } )    
      const publishPromises = devices.map( ( device ) => {
        logger.info( `Sending offline event for device ${device.name}` )
        return this.gateway.publishDeviceState( device.name, { status : 'offline' } )
      } )      
      await Promise.all( publishPromises )
      logger.info( 'All offline events sent' )
      await new Promise( resolve => setTimeout( resolve, 1000 ) )
    } catch ( err ) {
      logger.error( `Error sending data to cloud iot core ${err}`, err )
    }

    this.gateway.stop()
    logger.info( 'Done' )
  }
}

module.exports = EdgeServer
