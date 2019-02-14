graph TD
A[Edge Server] --> B(Device Listener)
A[Edge Server] --> C(Image Classifier)
A[Edge Server] --> D(CloudIoTCoreGateway)
A[Edge Server] --> E(WebInterface)
B --> |Search via mDns| F[fa:fa-camera Cameras]
C --> |Classify with Tensorflow| G[Queue Data]
D --> |Send Queue Data| H[Google Cloud]
E -->  |Web Socket| Z(Socket.io)
E -->  X(Web)
