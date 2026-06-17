# Mural 29 — Tijolinho Digital

Versão ajustada para o projeto comercial de venda de tijolinhos digitais.

## O que esta versão traz

- Fundo do grid substituído por versão técnica da imagem limpa, convertida para encaixar bloco por bloco.
- Logo novo `Mural 29` aplicado no cabeçalho.
- Imagem de marcação usada como referência para as áreas restritas.
- Grid configurado em **232 colunas x 125 linhas = exatamente 29.000 blocos**.
- Imagem do mural em **2320 x 1250 px**, com cada bloco do site representando **10 x 10 px** da imagem.
- Áreas principais:
  - Copacabana: R$ 9,00 por tijolinho
  - Leblon: R$ 149,00 por tijolinho
  - Ipanema: R$ 49,00 por tijolinho
- Placas dos bairros como áreas restritas/bloqueadas.
- Sem taxa extra operacional.
- Docker mantido no modo leve para EasyPanel com pouca memória.

## Arquivos importantes

```txt
public/mural-rio.png          # nova imagem de fundo limpa
public/logo-mural-29.png      # logo novo
lib/grid.ts                   # tamanho do grid e áreas restritas
config/site.config.json       # textos, preços e marca
prisma/seed.js                # cria grid novo
prisma/sync-grid-categories.js # sincroniza grid em banco já existente
```

## Depois de subir no EasyPanel

Se for banco novo:

```bash
pnpm exec prisma db push
pnpm run seed
```

Se o banco já existe:

```bash
pnpm run sync:grid
```

## Variáveis necessárias

```txt
DATABASE_URL=postgresql://...
NODE_ENV=production
MERCADO_PAGO_ACCESS_TOKEN=...
APP_URL=https://seu-link-atual
NEXT_PUBLIC_APP_URL=https://seu-link-atual
ADMIN_API_SECRET=sua_senha_admin_opcional
```

## Observação comercial/legal

Este é um projeto comercial de venda de espaços digitais em um mural público. A compra de tijolinhos digitais não constitui doação, investimento, sorteio, rifa ou promessa de retorno financeiro.


## V15

- Grid/mural travado para preencher a tela no celular.
- Zoom mínimo não deixa o grid diminuir demais.
- Navegação mobile prioriza arrastar para os lados, com eixo vertical centralizado.
