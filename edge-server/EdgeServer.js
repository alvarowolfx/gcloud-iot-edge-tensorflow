
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
        const { classes, trackedClasses, countClasses } = this.classifier.filterClasses( predictions )        
        console.log( 'Found classes', device.name, countClasses )
        if ( trackedClasses.length > 0 ) {
          console.log( 'Found tracking target on device', device.name, trackedClasses )
          // Do something with data
        }
        return {
          name : device.name,
          trackedClasses,
          countClasses,
          classes
        }
      } catch ( e ) {
        console.error( 'Error fetching image from device', device.name, e.message )  
        return null
      }
    } )

    // Wait for inference results and filter for valid ones
    const results = await Promise.all( promises )    
    const filteredResults = results.filter( res => !!res )
    
    // Update local web interface
    this.web.broadcastData( 'devices', filteredResults )

    // Send data to cloud iot core    
    try {
      await Promise.all( 
        results.map( ( res ) => {
          return this.gateway.publishDeviceTelemetry( res.name, res.countClasses )
        } )    
      )
    } catch ( e ) {
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
