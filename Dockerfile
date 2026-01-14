# -------------------------------- STAGE 1: BUILD --------------------------------

FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# -------------------------------- STAGE 2: RUNTIME --------------------------------

FROM node:24-alpine AS runtime

WORKDIR /app

# Add ffmpeg for media processing capabilities
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/package*.json .
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
