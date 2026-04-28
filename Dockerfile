FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN echo "VITE_SUPABASE_URL=" > client/.env && \
    echo "VITE_SUPABASE_ANON_KEY=" >> client/.env

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
