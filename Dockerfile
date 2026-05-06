# ═══ Stage 1: Dependencies ═══
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ═══ Stage 2: Builder ═══
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Explicitly set build-time environment variables for Vite
ENV VITE_FIREBASE_API_KEY=AIzaSyAIxCHDN8J-zi3h4ms7hqVbN0qd2YDUGhU
ENV VITE_FIREBASE_AUTH_DOMAIN=heidless-apps-2.firebaseapp.com
ENV VITE_FIREBASE_PROJECT_ID=heidless-apps-2
ENV VITE_FIREBASE_STORAGE_BUCKET=heidless-apps-2.firebasestorage.app
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=789026577646
ENV VITE_FIREBASE_APP_ID=1:789026577646:web:5570644be044b1ca0fa7ff
ENV VITE_FIREBASE_DATABASE_ID=promptmaster-spa-db-0
ENV VITE_PROMPTTOOL_URL=https://prompttool-789026577646.us-central1.run.app
ENV VITE_PROMPTTOOL_API_URL=https://prompttool-789026577646.us-central1.run.app/api/generate

RUN npm run build

# ═══ Stage 3: Runner ═══
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 spauser

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.cjs ./server.cjs

RUN chown -R spauser:nodejs /app
USER spauser

EXPOSE 8080
ENV PORT 8080

CMD ["node", "server.cjs"]
