FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node admin-api.mjs admin-policy.mjs ./
USER node
EXPOSE 3001
CMD ["node", "admin-api.mjs"]
