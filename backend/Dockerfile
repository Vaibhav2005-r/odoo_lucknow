FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl

# the Prisma CLI (a dev dependency) is needed at start-up to apply migrations, so install everything
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src

ENV NODE_ENV=production
EXPOSE 5000
# apply any pending migrations, then start the API and the nightly billing job
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
