#!/bin/bash
export GCS_BUCKET=gcloud-iot-edge-tf-records

gsutil cp training/train.record gs://${GCS_BUCKET}/data/train.record
gsutil cp training/val.record gs://${GCS_BUCKET}/data/val.record
gsutil cp training/pascal_label_map.pbtxt gs://${GCS_BUCKET}/data/pascal_label_map.pbtxt
#gsutil cp training/faster_rcnn_resnet101_coco.config gs://${GCS_BUCKET}/data/faster_rcnn_resnet101_coco.config
gsutil cp pipeline.config gs://${GCS_BUCKET}/data/pipeline.config