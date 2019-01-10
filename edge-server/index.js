require( '@tensorflow/tfjs-node' )
// global.fetch = require( 'node-fetch' )

const EdgeServer = require( './EdgeServer' )

const config = {
  classifier : {
    trackingTags : [ 'cats', 'person', 'dogs' ],
    threshold : 0.6,
    mode : 'detect'
  },
  web : {
    port : 3000
  },
  gateway : { 
    projectId : 'gcloud-iot-edge', 
    cloudRegion : 'us-central1', 
    registryId : 'iot-edge-registry',  
    gatewayId : 'gw-mark-one', 
    privateKeyFile : '../ec_private.pem'
  }
}

const server = new EdgeServer( config )
server.start()

async function gracefulShutdown() {
  try {
    console.info( 'SIGTERM signal received.' )
    console.info( 'Shutting down server.' )
    await Promise.race( [
      server.stop(),
      new Promise( ( resolve, reject ) => {
        setTimeout( () => {
          reject()
        }, 5000 )
      } )
    ] )
    process.exit( 0 )
  } catch ( err ) {
    console.error( 'Forced shutdown', err )
    process.exit( 1 )
  }
}

process.on( 'SIGTERM', gracefulShutdown )
process.on( 'SIGINT', gracefulShutdown )
