# ArenaSparking

[Demonstração no GitHub Pages](https://jeanviana01.github.io/Arena-Sparking/)

O frontend fica na raiz do repositório, com o index.html como entrada. O GitHub Pages publica os arquivos estáticos. A API Node.js fica em backend/server.mjs e usa SQLite para guardar a arena, os combates, a chave e a fila de espera.

## Prévia local

Use Node.js 24 ou superior. Não há dependências de terceiros para instalar.

```powershell
$env:ARENA_ADMIN_TOKEN = 'troque-por-uma-chave-longa-e-aleatoria'
npm start
```

- Site: http://127.0.0.1:4173/
- Gestão: http://127.0.0.1:4173/admin.html

O servidor grava o banco em data/arena.sqlite. Os dados antigos do navegador não são importados automaticamente. Abrir os HTMLs diretamente pelo Explorer usa a versão de demonstração e o armazenamento local, sem se conectar à API.

## Hospedagem do backend

Hospede o Dockerfile ou execute o projeto com Node 24 em um serviço com HTTPS e disco persistente. Use uma instância da API e mantenha o banco no volume persistente.

- ARENA_ADMIN_TOKEN: chave longa e aleatória, guardada como segredo no serviço de hospedagem.
- ARENA_DATABASE: caminho do arquivo SQLite no volume persistente. No Docker, monte o volume em /app/data com permissão de escrita para o usuário node.
- ARENA_ORIGINS: origem do frontend no GitHub Pages, por exemplo https://seu-usuario.github.io. Para domínio próprio, use a origem correspondente. Origens adicionais podem ser separadas por vírgulas.
- HOST: 0.0.0.0 no serviço hospedado. PORT: porta atribuída pelo serviço.

Com o backend ativo, acesse /admin.html no domínio dele para administrar resultados. O painel usa a chave fornecida e nenhuma chave é incluída no frontend público.

## GitHub Pages

A demonstração é publicada a partir da raiz da branch `main`. Ela usa dados de exemplo e salva os cadastros no navegador. Para compartilhar resultados e usar a administração, execute a API Node.js conforme as instruções acima.
