FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]