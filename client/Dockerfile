FROM node:24-alpine AS build
SHELL ["/bin/sh", "-exc"]
WORKDIR /app
COPY package.json package-lock.json ./
RUN node --version
RUN npm --version
RUN npm ci --include=dev --loglevel=verbose
RUN ls -la node_modules/vite/bin node_modules/typescript && test -f node_modules/vite/bin/vite.js
COPY . .
RUN npm run build
RUN ls -la /app/dist && test -s /app/dist/index.html

FROM nginx:1.30.6-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
