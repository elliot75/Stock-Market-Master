# Base image
FROM node:20-alpine AS base
RUN npm install -g turbo
WORKDIR /app

# Prune the workspace for the specific app
FROM base AS pruner
ARG APP_NAME
COPY . .
RUN turbo prune ${APP_NAME} --docker

# Install dependencies
FROM base AS installer
ARG APP_NAME
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm install

# Build the project
FROM base AS builder
ARG APP_NAME
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo build --filter=${APP_NAME}

# Final image
FROM node:20-alpine AS runner
ARG APP_NAME
ENV APP_NAME=${APP_NAME}
WORKDIR /app
COPY --from=builder /app/ .

# Identify the start command based on APP_NAME
# This is a simplified version; in production, you might want specific entrypoints
CMD ["sh", "-c", "npm run start -w ${APP_NAME}"]
