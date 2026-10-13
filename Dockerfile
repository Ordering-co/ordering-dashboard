FROM node:22-bookworm-slim AS development
WORKDIR /dashboard
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3001
CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "3001"]
