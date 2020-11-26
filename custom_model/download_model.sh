#!/bin/bash
export GCS_BUCKET=gcloud-iot-edge-tf-records

# curl -O http://storage.googleapis.com/download.tensorflow.org/models/object_detection/faster_rcnn_resnet101_coco_11_06_2017.tar.gz
# tar -xvf faster_rcnn_resnet101_coco_11_06_2017.tar.gz
# gsutil cp faster_rcnn_resnet101_coco_11_06_2017/model.ckpt.* gs://${GCS_BUCKET}/data/

# curl -O https://raw.githubusercontent.com/tensorflow/models/master/research/object_detection/samples/configs/ssd_mobilenet_v1_0.75_depth_quantized_300x300_pets_sync.config
pushd /tmp
curl -O http://download.tensorflow.org/models/object_detection/ssd_mobilenet_v1_0.75_depth_300x300_coco14_sync_2018_07_03.tar.gz /tmp/ssd_mobilenet_v1_0.75_depth_300x300_coco14_sync_2018_07_03.tar.gz
tar xzf ssd_mobilenet_v1_0.75_depth_300x300_coco14_sync_2018_07_03.tar.gz
gsutil cp /tmp/ssd_mobilenet_v1_0.75_depth_300x300_coco14_sync_2018_07_03/model.ckpt.* gs://${GCS_BUCKET}/data/
popd