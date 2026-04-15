FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 12824
ENV CHOKIDAR_USEPOLLING=true
CMD ["npm", "start"]
