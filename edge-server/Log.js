const { createLogger, format, transports } = require( 'winston' )

const { combine, timestamp, label, printf } = format

const appFormat = printf( ( info ) => {  
  return `${info.timestamp} ${info.level}: [${info.label}] ${info.message}`
} )

function create( customLabel ) {
  const logger = createLogger( {
    format : combine(
      label( { label : customLabel } ),
      timestamp(),
      appFormat
    ),
    transports : [    
      new transports.File( { filename : 'error.log', level : 'error' } ),
      new transports.File( { filename : 'combined.log' } )
    ]
  } )

  if ( process.env.NODE_ENV !== 'production' ) {
    logger.add( new transports.Console() )
  }

  return logger
}

module.exports = create
