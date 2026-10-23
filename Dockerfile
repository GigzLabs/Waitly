# Waitly — production image (multi-stage, standalone Next.js output)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 WAITLY_DATA_DIR=/app/data
RUN addgroup -S waitly && adduser -S waitly -G waitly && mkdir -p /app/data && chown waitly:waitly /app/data
COPY --from=builder --chown=waitly:waitly /app/public ./public
COPY --from=builder --chown=waitly:waitly /app/.next/standalone ./
COPY --from=builder --chown=waitly:waitly /app/.next/static ./.next/static
USER waitly
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
