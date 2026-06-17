FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Instala devDependencies também para garantir que a versão fixa do Prisma do projeto esteja disponível.
RUN npm install --include=dev

COPY . .

# DATABASE_URL dummy apenas para o prisma generate/build.
# O EasyPanel sobrescreve com a DATABASE_URL real nas variáveis do app.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}

# Usa o Prisma local do projeto. Isso evita o npx baixar Prisma 7 automaticamente.
RUN ./node_modules/.bin/prisma generate

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
