# Asset Tracking using Edge Computing and Computer Vision.

A bunch of ESP32 with camera, a local server (probablye a raspberry pi ) running image classification and object detection using Tensorflow and sending the data to 
processed data to Google Cloud.

[Work in Progress]

### Upload firmware with PlatformIO

Open `esp32-camera-firmware` folder on PlatformIO. Now the firmware have support for two models of esp32 with camera:

* ESP32 Cam from M5 Stack 
* ESP32 Cam from SeedStudio

Depending on your model, change on the platformio.ini file the `env_default` configuration depending on your board (`m5cam` or `esp32cam`). Also you need to change the Wifi credentials on the `sdkconfig.h` file ( `CONFIG_WIFI_SSID` and `CONFIG_WIFI_PASSWORD`). 

Then click on upload to flash the firmware into the board.

### Run server edge node

The server was written using NodeJS, Tensorflow.js library and the CocoSSD model to detect objects on the image.

Run the following commands inside the `edge-server` folder to setup the server:

* Install dependencies:
    * `npm install`
* Run server:
    * `npm start`
* Open `localhost:3000` to see the UI

### Google Cloud Setup

[Work in Progress]