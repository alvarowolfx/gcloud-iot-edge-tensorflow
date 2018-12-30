#!/bin/bash

. set_env_vars.sh $1

# Enable Services
SERVICES=(
  cloudiot
  pubsub
)

for svc in ${SERVICES[@]};
do
  printf "Enabling Service: ${svc}\n"
  gcloud services enable ${svc}.googleapis.com
done

# Create pubsub topic & save topic in env variable 
gcloud pubsub topics create $PUBSUB_TOPIC
gcloud pubsub subscriptions create $PUBSUB_TOPIC-sub --topic=$PUBSUB_TOPIC  --topic-project=$GCLOUD_PROJECT
gcloud iot registries create $REGISTRY --region=$LOCATION --event-notification-config=topic=$PUBSUB_TOPIC

# Create gateway
./generate_key_pair.sh
gcloud beta iot devices create $GATEWAY_ID \
--device-type=gateway \
--region=$LOCATION \
--registry=$REGISTRY \
--project=$GCLOUD_PROJECT \
--public-key path=ec_public.pem,type=es256-pem \
--auth-method=ASSOCIATION_ONLY

