# Tijolinho Digital — versão mural Rio

Esta versão já está ajustada com:

- mural visual baseado na imagem com Copacabana, Leblon e Ipanema
- preços atualizados:
  - Copacabana: R$ 9 por bloco
  - Ipanema: R$ 49 por bloco
  - Leblon: R$ 149 por bloco
- sem taxa extra no checkout
- placas dos bairros como áreas restritas
- imagem do mural incluída em `public/mural-rio.png`

## Subir no servidor

1. envie os arquivos para o servidor
2. instale as dependências:

```bash
npm install
```

3. gere o Prisma Client:

```bash
npm run prisma:generate
```

4. se o banco já existe e você quer adaptar o grid atual para o novo mural, rode:

```bash
npm run sync:grid
```

5. depois faça o build e suba:

```bash
npm run build
npm run start
```

## Observação importante

Se for um banco novo, depois do `prisma db push` você pode usar o seed:

```bash
npm run seed
```

Se o banco já está em uso, prefira `npm run sync:grid` para reaproveitar a base existente.
