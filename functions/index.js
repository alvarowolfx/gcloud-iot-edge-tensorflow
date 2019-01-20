const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.database()

exports.processTelemetry = functions
  .pubsub
  .topic('telemetry')
  .onPublish( handleMessage('data') )

exports.processState = functions
  .pubsub
  .topic('state')
  .onPublish( handleMessage('meta') )

function handleMessage( topic ) {
  return ( message, context ) => {
    const attributes = message.attributes
    const payload = message.json

    const deviceId = attributes['deviceId']

    const data = Object.assign({}, payload, {          
      updated: context.timestamp
    })

    return db.ref(`/devices/${deviceId}/${topic}`).update(data)
  }
}