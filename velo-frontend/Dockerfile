FROM node:22-alpine AS build

WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/ apps/
COPY packages/ packages/
COPY scripts/ scripts/
COPY tsconfig.json ./
COPY turbo.json ./

ARG APP
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
RUN test -n "$APP" && case "$APP" in admin|rider|driver|landing) ;; *) echo "APP must be admin, rider, driver, or landing" >&2; exit 1 ;; esac
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm ci
RUN npm run build --workspace="@velo/$APP"

FROM node:22-alpine AS runtime
WORKDIR /app
ARG APP
ENV APP=$APP
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/$APP/.next/standalone/ ./apps/$APP/.next/standalone/
COPY --from=build --chown=node:node /repo/apps/$APP/.next/static/ ./apps/$APP/.next/static/
COPY --from=build --chown=node:node /repo/scripts/start-standalone.mjs ./scripts/start-standalone.mjs
WORKDIR /app/apps/$APP
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "node scripts/start-standalone.mjs \"$APP\" 3000"]
