FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN node --version && npm --version && npm ci --include=dev \
    && test -f node_modules/vite/bin/vite.js \
    && test -f node_modules/typescript/package.json
COPY . .
RUN npm run build && test -s /app/dist/index.html

FROM nginx:1.30.6-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
