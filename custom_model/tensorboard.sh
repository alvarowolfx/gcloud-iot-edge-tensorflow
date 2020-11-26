#!/bin/bash
export GCS_BUCKET=gcloud-iot-edge-tf-records

tensorboard --logdir=gs://${GCS_BUCKET}/train
