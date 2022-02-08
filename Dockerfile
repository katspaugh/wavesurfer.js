FROM public.ecr.aws/docker/library/node:14.17.5

ENV WORKDIR /wavesurfer.js
ENV NODE_ENV production

ARG ANIMOTO_NPM_TOKEN
ARG GITHUB_TOKEN

WORKDIR $WORKDIR

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
