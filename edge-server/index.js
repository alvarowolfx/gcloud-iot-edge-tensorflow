require( '@tensorflow/tfjs-node' )
// global.fetch = require( 'node-fetch' )

const EdgeServer = require( './EdgeServer' )

const trackingTags = [ 'cats', 'person', 'dogs' ]
const threshold = 0.6

const server = new EdgeServer( {
  trackingTags,
  threshold,
  mode : 'detect'
} )
server.start()

process.on( 'SIGTERM', () => {
  console.info( 'SIGTERM signal received.' )
  console.info( 'Shutting down server.' )
  server.stop()
} )
