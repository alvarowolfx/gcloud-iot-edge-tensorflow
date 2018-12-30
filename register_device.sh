#!/bin/bash

. set_env_vars.sh $1

DEVICE=$2

# Create device
gcloud iot devices create $DEVICE \
--region=$LOCATION \
--registry=$REGISTRY 

# Bind device to gateway
gcloud beta iot devices gateways "bind" \
--gateway=$GATEWAY_ID \
--gateway-region=$LOCATION \
--gateway-registry=$REGISTRY \
--device=$DEVICE \
--device-region=$LOCATION \
--device-registry=$REGISTRY 