#!/bin/bash
export GCS_BUCKET=gcloud-iot-edge-tf-records

export CONFIG_FILE=gs://${GCS_BUCKET}/data/pipeline.config
export CHECKPOINT_PATH=gs://${GCS_BUCKET}/train/model.ckpt-10000
export OUTPUT_DIR=/tmp/tflite

export TENSORFLOWLIBPATH=/Users/alvaroviebrantz/Documents/Desenvolvimento/Python/models/research
export PYTHONPATH=$PYTHONPATH:$TENSORFLOWLIBPATH:$TENSORFLOWLIBPATH/slim

python $TENSORFLOWLIBPATH/object_detection/export_inference_graph.py \
  --pipeline_config_path=$CONFIG_FILE \
  --trained_checkpoint_prefix=$CHECKPOINT_PATH \
  --output_directory=$OUTPUT_DIR \
  --add_postprocessing_op=true