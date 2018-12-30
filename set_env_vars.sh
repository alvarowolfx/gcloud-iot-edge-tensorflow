#!/bin/bash

export LOCATION="us-central1"
export GATEWAY_ID="gw-mark-one"
export REGISTRY="iot-edge-registry"
export PUBSUB_TOPIC="telemetry"

if [ -z "$GCLOUD_PROJECT" ]; then  
  printf "\nOnce you've logged into your project, enter the project id below."
  GCLOUD_PROJECT="$1"
  if [ -z "$1" ]; then
    echo 
    read -p 'Please enter project id: ' GCLOUD_PROJECT
    echo
  fi
  if [ -z "$GCLOUD_PROJECT" ]; then
  cat<<KEYERR
    ***WARNING: Inform a valid gcloud project id     
KEYERR
    exit 1
  fi
fi

export GCLOUD_PROJECT=$GCLOUD_PROJECT
gcloud config set project $GCLOUD_PROJECT