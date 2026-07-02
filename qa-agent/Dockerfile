FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server ./server
COPY web ./web
COPY knowledge ./knowledge
COPY scripts ./scripts
EXPOSE 8787
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
