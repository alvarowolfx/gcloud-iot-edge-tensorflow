const fs = require( 'fs' )
const jwt = require( 'jsonwebtoken' )
const mqtt = require( 'async-mqtt' )

const createLogger = require( './Log' )

const logger = createLogger( 'CloudIoTCoreGateway' )

class CloudIoTCoreGateway {
  constructor( { projectId, cloudRegion, registryId, gatewayId, privateKeyFile } ) {          
    this.projectId = projectId
    this.cloudRegion = cloudRegion
    this.registryId = registryId
    this.gatewayId = gatewayId
    this.privateKeyFile = privateKeyFile

    this.tokenExpMins = 20 // Token expiration time in minutes
  }  

  start() {
    this.connect()
    this.connectionTicker = setInterval( this.checkConnection.bind( this ), 10000 )    
  }

  stop() {
    logger.info( 'Closing...' )    
    if ( this.client ) {
      this.client.end()
    }
    if ( this.connectionTicker ) { 
      clearInterval( this.connectionTicker )
    }
    logger.info( ' Done' )
  }
  
  connect() {
    if ( this.client ) {
      this.client.end()
    }

    // Cloud iot core requires a specific client id 
    const clientId = `projects/${this.projectId}/locations/${
      this.cloudRegion
    }/registries/${this.registryId}/devices/${this.gatewayId}`

    const connectionArgs = {
      host : 'mqtt.googleapis.com',
      port : 8883,
      clientId,
      username : 'unused',
      password : this.createJwt(),
      protocol : 'mqtts',
      secureProtocol : 'TLSv1_2_method',
    }
    
    // Create a client, and connect to the Google MQTT bridge
    this.iatTime = parseInt( Date.now() / 1000 )    
    this.client = mqtt.connect( connectionArgs )    
  }

  checkConnection() {
    const secsFromIssue = parseInt( Date.now() / 1000 ) - this.iatTime
    if ( secsFromIssue > this.tokenExpMins * 60 ) {      
      logger.info( `\tRefreshing token after ${secsFromIssue} seconds.` )
      this.connect()
    }
  }

  /*
   * Create a Cloud IoT Core JWT for the given project id, signed with the given
   * private key.
   */
  createJwt() {
    const algorithm = 'ES256'    
    const token = {
      iat : parseInt( Date.now() / 1000 ),
      exp : parseInt( Date.now() / 1000 ) + this.tokenExpMins * 60,
      aud : this.projectId,
    }
    const privateKey = fs.readFileSync( this.privateKeyFile )
    return jwt.sign( token, privateKey, { algorithm } )
  }

  publish( deviceId, payload, eventType ) {
    const mqttTopic = `/devices/${deviceId}/${eventType}`
    return this.client.publish( mqttTopic, JSON.stringify( payload ), { qos : 1 } )
  }

  attachDevice( deviceId ) {
    return this.publish( deviceId, {}, 'attach' )
  }

  detachDevice( deviceId ) {
    return this.publish( deviceId, {}, 'detach' )
  }

  publishDeviceTelemetry( deviceId, payload ) {
    return this.publish( deviceId, payload, 'events' )
  }

  publishDeviceState( deviceId, payload ) {
    return this.publish( deviceId, payload, 'state' )        
  }

  publishGatewayTelemetry( payload ) {
    return this.publish( this.gatewayId, payload, 'events' )        
  }

  publishGatewayState( payload ) {
    return this.publish( this.gatewayId, payload, 'state' )        
  }
}

module.exports = CloudIoTCoreGateway
