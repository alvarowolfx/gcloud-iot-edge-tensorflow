#!/bin/bash
export GCS_BUCKET=gcloud-iot-edge-tf-records
export TENSORFLOWLIB=/Users/alvaroviebrantz/Documents/Desenvolvimento/Python/models/research

gcloud ml-engine jobs submit training `whoami`_object_detection_eval_validation_`date +%s` \
    --job-dir=gs://${GCS_BUCKET}/train \
    --packages ${TENSORFLOWLIB}/dist/object_detection-0.1.tar.gz,${TENSORFLOWLIB}/slim/dist/slim-0.1.tar.gz,/tmp/pycocotools/pycocotools-2.0.tar.gz \
    --module-name object_detection.model_main \
    --runtime-version 1.12 \
    --python-version 3.5 \
    --scale-tier BASIC_GPU \
    --region us-central1 \
    -- \
    --model_dir=gs://${GCS_BUCKET}/train \
    --pipeline_config_path=gs://${GCS_BUCKET}/data/pipeline.config \
    --checkpoint_dir=gs://${GCS_BUCKET}/train

