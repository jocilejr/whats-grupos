FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

RUN mkdir -p /data/baileys-sessions

EXPOSE 3100

CMD ["node", "server.js"]
