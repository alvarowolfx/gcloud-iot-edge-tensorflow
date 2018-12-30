const EventEmitter = require( 'events' )
const mdns = require( 'mdns' )
const AbortController = require( 'abort-controller' )
const fetch = require( 'node-fetch' )
const jpeg = require( 'jpeg-js' )

const createLogger = require( './Log' )

const logger = createLogger( 'DeviceListener' )

class CameraDevice {
  constructor( service ) {
    this.name = service.name
    this.host = service.host
    this.addresses = service.addresses    
  }

  /* 
   * Using ip address directly is faster
   */
  getImageUrl() {
    let host = `${this.name}.local`
    if ( this.addresses && this.addresses.length > 0 ) {
      host = `${this.addresses[0]}`
    }
    return `http://${host}/jpg`
  }

  async fetchImage() {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => { controller.abort() },
      1000,
    )

    const url = this.getImageUrl()    
    try {
      const res = await fetch( url, { signal : controller.signal } )    
      const buffer = await res.arrayBuffer()    
      const image = jpeg.decode( buffer, true )    
      return image
    } catch ( e ) {
      throw new Error( 'Error Fetching Image' )
    } finally {
      clearTimeout( timeout )
    }
  }
}


class DeviceListener extends EventEmitter {
  constructor() {
    super()
    const sequence = [
      mdns.rst.DNSServiceResolve(),
      'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo( { families : [ 0 ] } ),
      mdns.rst.makeAddressesUnique()
    ]    
    this.browser = mdns.createBrowser( mdns.tcp( 'camera' ), { resolverSequence : sequence } )     
    this.devices = {}
  }

  start() {
    this.browser.start()
    this.browser.on( 'serviceUp', ( service ) => {
      const { name } = service
      logger.info( `service up: ${name}` )
      this.devices[name] = new CameraDevice( service )
      this.emit( 'deviceAdded', name )      
    } )
    this.browser.on( 'serviceDown', ( service ) => {
      const { name } = service
      logger.info( `service down: ${name}` )
      delete this.devices[name]
      this.emit( 'deviceRemoved', name )
    } )
  }

  onDeviceAdded( callback ) {
    return this.on( 'deviceAdded', callback )
  }

  onDeviceRemoved( callback ) {
    return this.on( 'deviceRemoved', callback )
  }

  stop() {
    logger.info( 'Closing...' )
    this.browser.stop()
    this.removeAllListeners()
    logger.info( 'Done' )
  }

  getDevices() {
    return Object.values( this.devices )
  }
    
}

module.exports = DeviceListener
