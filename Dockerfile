FROM node:20-alpine

WORKDIR /app

# Usa pnpm para evitar travamentos do npm no build do EasyPanel.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package*.json ./

RUN pnpm install --no-frozen-lockfile

COPY . .

ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

RUN pnpm exec prisma generate

RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "start"]
