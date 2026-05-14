FROM node:22-alpine AS builder

WORKDIR /app

COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/
COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/

RUN npm ci --prefix client && npm ci --prefix server

COPY client ./client
COPY server ./server

# Use same-origin API calls in the deployed web bundle. The API key is already
# sent by the browser in this app's current auth model, so it must be compiled
# into the Expo web build.
ARG EXPO_PUBLIC_API_ORIGIN=""
ARG EXPO_PUBLIC_API_KEY
ENV EXPO_PUBLIC_API_ORIGIN=$EXPO_PUBLIC_API_ORIGIN
ENV EXPO_PUBLIC_API_KEY=$EXPO_PUBLIC_API_KEY

RUN npm run build --prefix client
RUN npm run db:generate --prefix server
RUN npm run build --prefix server

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/client/asset ./client/asset

EXPOSE 3000

CMD ["sh", "-c", "npm run db:push --prefix server && node server/dist/index.js"]
