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

# Create pubsub topics for events and state
gcloud pubsub topics create $PUBSUB_TOPIC_EVENTS
gcloud pubsub subscriptions create $PUBSUB_TOPIC_EVENTS-sub --topic=$PUBSUB_TOPIC_EVENTS  --topic-project=$GCLOUD_PROJECT
gcloud pubsub topics create $PUBSUB_TOPIC_STATE
gcloud pubsub subscriptions create $PUBSUB_TOPIC_STATE-sub --topic=$PUBSUB_TOPIC_STATE  --topic-project=$GCLOUD_PROJECT
gcloud iot registries create $REGISTRY \
--region=$LOCATION 
--event-notification-config=topic=$PUBSUB_TOPIC_EVENTS \
--state-pubsub-topic=$PUBSUB_TOPIC_STATE

# Create gateway
if [ ! -f ./ec_public.pem ]; then
	./generate_key_pair.sh
else 
  echo "Certificates already exists."
fi

gcloud beta iot devices create $GATEWAY_ID \
--device-type=gateway \
--region=$LOCATION \
--registry=$REGISTRY \
--project=$GCLOUD_PROJECT \
--public-key path=ec_public.pem,type=es256-pem \
--auth-method=ASSOCIATION_ONLY

