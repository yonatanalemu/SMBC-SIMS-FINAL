FROM node:22-slim

WORKDIR /app

# openssl is required by Prisma's engine on Debian-slim images
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Hand /app to the node user BEFORE anything writes into it, so every
# later step (npm install, prisma generate, mkdir uploads) is owned by
# node from the start — nothing gets created as root anymore.
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/
RUN npm install

COPY --chown=node:node content ./curriculum
COPY --chown=node:node . .

USER root
RUN chown -R node:node /app/content
USER node
RUN npx prisma generate

RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node prisma/seed-certificates.js && node scripts/sync-content.js && node src/server.js"]
