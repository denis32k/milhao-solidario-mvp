FROM node:20-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=512

# Usa pnpm com baixa concorrência para não estourar memória no EasyPanel.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package*.json ./

RUN pnpm install --prod --no-frozen-lockfile --network-concurrency=1 --child-concurrency=1

COPY . .

ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

RUN pnpm exec prisma generate

RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "start"]
