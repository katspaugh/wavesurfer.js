FROM public.ecr.aws/docker/library/node:16.14.0

ENV WORKDIR /wavesurfer.js
ENV NODE_ENV production

ARG ANIMOTO_NPM_TOKEN
ARG GITHUB_TOKEN

WORKDIR $WORKDIR

# Setup puppeteer
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils

# Define the ANIMOTO_NPM_TOKEN enviornment variable for .npmrc
ENV ANIMOTO_NPM_TOKEN ${ANIMOTO_NPM_TOKEN}

# Require $GITHUB_TOKEN to be defined
RUN test -n "$GITHUB_TOKEN"

# Require $ANIMOTO_NPM_TOKEN to be defined
RUN test -n "$ANIMOTO_NPM_TOKEN"

# Write our .npmrc file to root directory for publishing
RUN echo "//registry.npmjs.org/:_authToken=${ANIMOTO_NPM_TOKEN}" >> ~/.npmrc


# Copy over the source
COPY . ${WORKDIR}/
RUN yarn install --production=false


# Set git config for commiting to repo
RUN git config user.email "techops@animoto.com"
RUN git config user.name "animoto-techops"
RUN git config remote.origin.url "https://${GITHUB_TOKEN}:@github.com/animoto/wavesurfer.js.git"

# Bootstrap and clean up the yarn cache to keep container size down
RUN yarn build && yarn cache clean
