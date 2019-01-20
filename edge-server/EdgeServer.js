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
    this.limiter = new RateLimiter( 3, 'minute' )

    this.deviceQueue = {}
    this.lastDeviceData = {}
  }

  async start() {
    this.stopped = false
    await this.classifier.load()
    this.deviceListener.start()
    this.web.start()
    await this.gateway.start()

    this.deviceListener.onDeviceAdded( async ( deviceId ) => {      
      await this.gateway.attachDevice( deviceId )
      this.gateway.publishDeviceState( deviceId, { status : 'online', type : 'camera' } )
    } )

    this.deviceListener.onDeviceRemoved( async ( deviceId ) => {      
      this.gateway.publishDeviceState( deviceId, { status : 'offline' } )
      this.gateway.detachDevice( deviceId )
    } )

    this.run()    
    // this.ticker = setInterval( this.run.bind( this ), 10000 )

    const serverInfo = this.web.getServerInfo()
    await this.gateway.publishGatewayState( { status : 'online', server : serverInfo, type : 'gateway' } )
  }

  hasChanges() {    
    const hasChanged = Object.keys( this.deviceQueue ).some( ( deviceId ) => {
      return JSON.stringify( this.deviceQueue[deviceId] ) !== JSON.stringify( this.lastDeviceData[deviceId] ) 
    } )
    return hasChanged
  }

  queueData( device, { classes, trackedClasses, countClasses } ) {
    const { name } = device
    let deviceData = this.deviceQueue[name]    
    if ( !deviceData ) {
      deviceData = {
        name,
        classes : [], 
        trackedClasses : [],
        countClasses : {},
      }      
      this.deviceQueue[name] = deviceData
    }

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

    const nDeviceData = {
      name,
      classes : nClasses, 
      trackedClasses : nTrackedClasses,
      countClasses : nCountClasses
    }      
    
    this.deviceQueue[name] = nDeviceData
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
      if ( this.hasChanges() ) {
        if ( this.limiter.tryRemoveTokens( 1 ) ) {        
          logger.info( '[PublishData] Sending data to cloud iot core.' )
          const publishPromises = Object.keys( this.deviceQueue ).map( ( deviceId ) => {
            const res = this.deviceQueue[deviceId]
            this.lastDeviceData[deviceId] = res                        
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
      await new Promise( resolve => setTimeout( resolve, 2000 ) )
    } catch ( err ) {
      logger.error( `Error sending data to cloud iot core ${err}`, err )
    }

    this.gateway.stop()
    logger.info( 'Done' )
  }
}

module.exports = EdgeServer
