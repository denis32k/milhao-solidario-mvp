# Milhão Solidário — Nova versão com admin, testes e configuração central

Esta versão implementa o resumo combinado e prepara o projeto para lapidação real.

## Configuração editável

Edite o arquivo:

```txt
config/site.config.json
```

Nele você consegue alterar:

- nome do projeto
- subtítulo
- emoji/logotipo simples
- nomes das áreas
- valores dos blocos
- taxa operacional
- frases principais
- cores do Mosaico Apoiador
- dados fictícios dos testes

## Nomes públicos das áreas

- Mosaico Apoiador — R$10
- Área Gold — R$100
- Área Diamante — R$500
- Área Legendária — bloqueada

## Grid

- Total: 29.000 blocos
- Mosaico Apoiador: 10.000 blocos em volta de todo o grid
- Área Gold: 18.600 blocos no miolo
- Área Diamante: 300 blocos em volta do centro
- Área Legendária: 100 blocos bloqueados no centro, quadrado 10x10

## Frontend

- Grid limpo, sem botões +, - e centralizar
- Zoom no PC pelo scroll
- Zoom no celular com 2 dedos
- Página abre focada no centro
- Balãozinho pequeno ao clicar em bloco vendido
- Nome da área aparece bem menor no balão
- Botão denunciar menor e discreto
- Link abre em nova aba

## Checkout

- Mosaico Apoiador: nome público, cor, link/Instagram e descrição
- Área Gold: imagem, nome público, descrição e link
- Área Diamante: imagem, nome público, descrição e link
- Nome completo, WhatsApp e CPF ficam privados
- Imagem é compactada antes do upload

## Admin

O admin tem:

- dashboard
- últimas compras
- reservas pendentes
- Área Gold e Área Diamante com imagem/link
- denúncias
- ações de moderação
- testes do grid

Ações disponíveis:

- bloquear imagem
- bloquear link
- liberar bloco
- banir comprador
- resolver denúncia
- criar área teste
- excluir teste individual
- excluir todos os testes

## Testes do grid

No admin, os testes não passam pelo checkout e não geram PIX.

- Criar teste Mosaico Apoiador
- Criar teste Área Gold
- Criar teste Área Diamante
- Excluir teste
- Excluir todos os testes

Os testes são marcados como `isTest = true` e não entram em:

- arrecadação
- ranking
- repasses
- compras reais

## Depois de subir no EasyPanel

Rode no terminal **Sh**:

```bash
npx prisma generate
npx prisma db push
npm run sync:grid
```

## Admin protegido

Configure:

```txt
ADMIN_API_SECRET=sua_senha_forte
```

Acesse:

```txt
/admin?secret=SUA_SENHA
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

## Importante

Domínio próprio e armazenamento definitivo das imagens ficam para depois.
Nesta versão, o upload ainda usa armazenamento local do app.
