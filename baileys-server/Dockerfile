FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

RUN mkdir -p /data/baileys-sessions

EXPOSE 3100

CMD ["node", "server.js"]
