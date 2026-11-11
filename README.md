# Controle Financeiro

Aplicativo de controle financeiro pessoal, feito para o celular (PWA). **Os dados ficam só no aparelho**: não há servidor, conta nem sincronização. A cópia de segurança é um arquivo de backup que você exporta e guarda onde quiser.

## Funcionalidades

- Lançamento de receitas e despesas com valor, data, categoria, conta e descrição
- Saldo do mês, divisão das despesas por categoria e últimos lançamentos
- Extrato do mês com busca por descrição ou categoria
- Relatórios: receitas × despesas dos últimos 6 ou 12 meses, taxa de economia, média diária, maior despesa e comparação com o mês anterior
- Categorias e contas personalizáveis (itens com lançamentos não podem ser excluídos; é preciso manter ao menos uma conta)
- Backup e restauração por arquivo, com aviso quando o último backup é antigo e cópia de segurança automática antes de importar
- Tema claro, escuro ou automático
- Funciona offline e pode ser instalado na tela inicial
- O botão Voltar do celular fecha a folha de lançamento e volta pelas abas; recarregar mantém a aba

## Tecnologias

React 19 · TypeScript · Vite · Tailwind CSS 4 · Dexie (IndexedDB) · Zod · vite-plugin-pwa
Qualidade: Vitest + Testing Library · Playwright · oxlint · Prettier · husky + lint-staged · GitHub Actions

## Como rodar

Requer Node 20 ou mais novo.

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173`.

## Scripts

| Comando                 | O que faz                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desenvolvimento                                         |
| `npm run build`         | Confere os tipos e gera a versão de produção em `dist/`             |
| `npm run preview`       | Serve a versão de produção localmente                               |
| `npm run check`         | Formatação, lint, tipos, testes e build (o mesmo que o CI cobra)    |
| `npm test`              | Testes unitários e de tela (Vitest)                                 |
| `npm run test:coverage` | Testes com relatório de cobertura                                   |
| `npm run test:e2e`      | Testes de ponta a ponta (Playwright), em tamanho de celular e de PC |
| `npm run lint`          | oxlint, com regras de React, acessibilidade e TypeScript            |
| `npm run typecheck`     | TypeScript em modo estrito                                          |
| `npm run format`        | Formata o código com Prettier                                       |

Os testes e2e usam o Chrome instalado no computador. No CI usam o Chromium do Playwright (`npx playwright install chromium`).

## Estrutura

```
src/
  App.tsx            Cabeçalho, navegação por abas e folha de lançamento
  db.ts              Banco local (Dexie): categorias, contas e lançamentos
  data.ts            Gravações com regras de integridade (tudo em transação)
  backup.ts          Validação, exportação e restauração do arquivo de backup
  screens/           Início, Extrato, Relatórios e Ajustes
  components/        TxSheet (novo/editar), TxRow, ManageList, Icon, LazyScreen
  hooks/             useData (consultas ao vivo), useNavigation, useTheme
  lib/               Funções puras: dinheiro, datas, relatórios (com testes)
  test/              Preparação dos testes
e2e/                 Testes de ponta a ponta
```

## Dados e privacidade

- Valores são guardados em **centavos (inteiros)**, para não haver erro de arredondamento.
- Datas são guardadas como texto `AAAA-MM-DD` no fuso local, para não trocar o dia perto da meia-noite.
- O app pede ao navegador para não apagar os dados quando faltar espaço (`navigator.storage.persist`). Mesmo assim, **faça backups**: limpar os dados do site no navegador apaga tudo.

### Backup

Em **Ajustes → Backup**, _Exportar_ gera `financas-backup-AAAA-MM-DD.json` (no celular abre a folha de compartilhar). _Importar_ **substitui** os dados do aparelho; antes de substituir, o app salva uma cópia dos dados atuais e só segue se ela foi salva. O arquivo é validado (datas existentes, limites de valor e de texto, ids únicos, categorias coerentes com o tipo do lançamento).

## Evoluindo o banco de dados

As instruções ficam em comentário no topo de `src/db.ts`. Em resumo: nunca edite uma versão existente do schema, acrescente `db.version(N+1)` com `.upgrade()` quando precisar converter dados, e mantenha o leitor de backup aceitando o formato antigo.

## Deploy

O app é estático (`dist/`, gerado por `npm run build`) e funciona em qualquer hospedagem de arquivos estáticos. O projeto está vinculado à Vercel na máquina de desenvolvimento; esse vínculo (pasta `.vercel`) não é versionado. O endereço usa só `#` para as abas, então não precisa de regra de reescrita no servidor.

O service worker atualiza o app sozinho quando há versão nova.

## Qualidade

- **CI** (`.github/workflows/ci.yml`): formatação, lint, tipos, testes com cobertura, build e testes e2e a cada push e pull request.
- **Hook de commit** (husky): formata e confere os arquivos alterados e roda o typecheck antes de cada commit.

## Licença

[MIT](LICENSE)
