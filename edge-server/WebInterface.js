const express = require( 'express' )
const { Server } = require( 'http' )
const SocketIO = require( 'socket.io' )


class WebInterface {
  constructor( { port } ) {
    this.app = express()
    this.server = Server( this.app )
    this.io = SocketIO( this.server )    

    this.port = port || 3000

    this.app.get( '/', this.indexHandler.bind( this ) )

  }

  start() {
    this.server.listen( this.port )
  }

  stop() {
    console.log( '[WebInterface] Closing...' )
    this.server.close( () => {
      console.log( '[WebInterface] Done' )
    } )

  }

  indexHandler( req, res ) {
    res.sendFile( `${__dirname}/index.html` )
  }

  broadcastData( channel, data ) {
    this.io.emit( channel, data )
  }
}

module.exports = WebInterface
