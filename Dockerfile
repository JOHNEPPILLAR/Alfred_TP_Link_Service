FROM node:16-alpine

## Create app folder
RUN mkdir -p /home/nodejs/app

## Install node deps and compile native add-ons
WORKDIR /home/nodejs/app

COPY . .

RUN npm install

## Set up host
ENV TZ=Europe/London

RUN apk add --no-cache --virtual \
	tzdata \
	curl \
	&& echo $TZ > /etc/timezone \
	&& rm -rf /var/cache/apk/*

## Set permissions
COPY --chown=node:node . .

## Swap to node user
USER node

## Setup health check
HEALTHCHECK --start-period=60s --interval=10s --timeout=10s --retries=6 CMD ["./healthcheck.sh"]

EXPOSE 3978
