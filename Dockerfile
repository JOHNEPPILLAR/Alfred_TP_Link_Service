FROM node:15-alpine AS builder

## Install build toolchain
RUN mkdir -p /home/nodejs/app \
	&& apk add --no-cache --virtual build-dependencies \
	git \ 
	g++ \
	gcc \
	libgcc \
	libstdc++ \
	linux-headers \
	make \
	python \
	&& npm install --quiet node-gyp -g

## Install node deps and compile native add-ons
WORKDIR /home/nodejs/app

COPY package*.json ./

RUN npm install

## Setup clean small container
FROM node:15-alpine AS app

ENV TZ=Europe/London

RUN mkdir -p /home/nodejs/app \
	&& mkdir -p /home/nodejs/app/node_modules \
	&& apk add --no-cache --virtual \
	tzdata \
	curl \
	&& echo $TZ > /etc/timezone \
	&& rm -rf /var/cache/apk/*

WORKDIR /home/nodejs/app

## Copy pre-installed/build modules and app
COPY --from=builder /home/nodejs/app .
COPY --chown=node:node . .

## Swap to node user
USER node

## Setup health check
HEALTHCHECK --start-period=60s --interval=10s --timeout=10s --retries=6 CMD ["./healthcheck.sh"]

EXPOSE 3978
