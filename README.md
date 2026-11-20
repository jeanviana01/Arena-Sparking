# ArenaSparking

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

1. Suba os arquivos deste pacote para a branch main de um repositório no GitHub.
2. Em Settings → Secrets and variables → Actions → Variables, crie ARENA_API_URL com a URL HTTPS do backend, sem /api.
3. Em Settings → Pages, escolha GitHub Actions como fonte.
4. Execute GitHub Pages na aba Actions ou envie uma alteração para main.

O workflow publica apenas as duas páginas públicas, os recursos visuais, a configuração da API e o JSON de demonstração. A gestão e o banco ficam fora do artefato do Pages.
