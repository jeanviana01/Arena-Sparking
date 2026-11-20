FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json *.html *.js *.json *.png ./
COPY --chown=node:node backend ./backend
RUN mkdir -p /app/data && chown node:node /app/data
ENV HOST=0.0.0.0 PORT=4173 ARENA_DATABASE=/app/data/arena.sqlite
USER node
EXPOSE 4173
CMD ["node", "backend/server.mjs"]
