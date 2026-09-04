# Bagdja Auction Web — renderer publik (Next.js) — build image untuk deploy
# di Coolify.
#
# CATATAN: base image node:22 (bukan node:20), konsisten dengan Dockerfile
# service lain di ekosistem ini.
#
# Pola beda dari Dockerfile NestJS: Next.js `output: 'standalone'`
# (next.config.js) sudah menghasilkan node_modules yang di-prune otomatis di
# dalam `.next/standalone` — jadi tidak perlu `npm prune` manual.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY . .
# public/ ada di repo tapi kosong — git tidak melacak direktori kosong, jadi
# di beberapa checkout foldernya bisa benar-benar tidak ada. Pastikan selalu
# ada supaya COPY --from=builder di stage production tidak gagal.
RUN mkdir -p public

# NEXT_PUBLIC_* WAJIB di-set sebagai build arg (bukan cuma env var runtime),
# karena Next.js meng-inline nilai NEXT_PUBLIC_* ke bundle client saat
# `next build` — kalau cuma diset di runtime container, browser tidak akan
# pernah melihatnya. Isi build arg ini di konfigurasi build Coolify.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_CLIENT_ID
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_REDIRECT_URI
ARG NEXT_PUBLIC_PLATFORM_URL
ARG NEXT_PUBLIC_EVENT_API
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_CLIENT_ID=$NEXT_PUBLIC_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_REDIRECT_URI=$NEXT_PUBLIC_REDIRECT_URI
ENV NEXT_PUBLIC_PLATFORM_URL=$NEXT_PUBLIC_PLATFORM_URL
ENV NEXT_PUBLIC_EVENT_API=$NEXT_PUBLIC_EVENT_API

RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# CATATAN: port dev lokal (5012, lihat package.json `dev`/`start`) itu
# konvensi untuk menghindari bentrok port antar proses di satu host yang
# sama. Di Coolify tiap app punya container/network sendiri jadi tidak ada
# risiko bentrok — pakai default Coolify (3000) untuk Next.js, konsisten
# dengan pola app/website/bagdja-website/Dockerfile. Coolify juga
# meng-override env var PORT saat runtime apapun yang di-set di sini, jadi
# ENV PORT di bawah ini cuma dokumentasi/fallback kalau image dijalankan di
# luar Coolify.
ENV PORT=3000
EXPOSE 3000

# WAJIB: server.js hasil `output: standalone` default listen di localhost
# (127.0.0.1) kalau HOSTNAME tidak di-set eksplisit — jadi tidak reachable
# dari container lain (mis. Traefik) di network Docker yang sama, walau
# EXPOSE-nya benar. Tanpa ini muncul "Connection refused"/502 Bad Gateway
# dari proxy meski container-nya sendiri sehat.
ENV HOSTNAME="0.0.0.0"

# Next.js standalone server sudah termasuk middleware.ts (host-based tenant
# resolution per-Market lewat subdomain/custom domain) — tidak butuh proses
# terpisah.
# Heap guard 288MB — pasangkan dengan Memory Limit 384MB di Coolify (Advanced
# > Resource Limits); Next.js SSR lebih berat dari service NestJS lain di
# ekosistem, host cuma 4GB dibagi ke banyak service jadi tidak ada budget
# scaling headroom.
CMD ["node", "--max-old-space-size=288", "server.js"]
