FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Instala dependências sem auditoria/funding para evitar travamentos do npm no build.
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .

# DATABASE_URL dummy apenas para o prisma generate/build.
# O EasyPanel sobrescreve com a DATABASE_URL real nas variáveis/build args do app.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

# Usa Prisma 6 fixo. Isso evita o npx baixar Prisma 7 automaticamente.
RUN npx --yes prisma@6.19.0 generate

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
