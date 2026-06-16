# Milhão Solidário MVP v3 pronto

Inclui Dockerfile, Prisma 6.19, seed dos 29.000 blocos, home lendo banco, ranking real, mapa lendo blocos vendidos e checkout fake do Mosaico Solidário.

## Deploy
Use Dockerfile no EasyPanel.

## Banco
npx prisma generate
npx prisma db push
node prisma/seed.js
