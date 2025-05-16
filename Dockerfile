FROM node:18

WORKDIR /app

# Copia los archivos del package para aprovechar el cache
COPY package*.json ./

# Instala dependencias (incluye @sap/cds como local)
RUN npm install

# Copia el resto del código fuente
COPY . .

# Verifica que cds esté en node_modules/.bin
RUN ls -l node_modules/.bin

# Ejecuta el build CAP desde el binario local
# RUN npm run build-docker

# Exponemos el puerto del CAP
EXPOSE 4004

# Inicia la app (usa también binario local)
CMD ["npm", "start"]
