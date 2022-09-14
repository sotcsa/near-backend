FROM node:16
COPY . /root/bot
WORKDIR /root/bot
RUN npm ci
ENTRYPOINT npm start