# Etapa 1: Compilación SPA con Node 20 LTS
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else npm install; fi

COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm build; else npm run build; fi

# Etapa 2: Servidor de Producción Nginx 1.26 Stable
FROM nginx:1.26-alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]