# Tableau de bord SOKORA Sport — image autonome pour l'usage local.
#
# Deux étages : Node construit le site, nginx le sert. Node ne subsiste pas dans
# l'image finale, ce qui évite d'installer quoi que ce soit sur le poste — seul
# Docker est requis.

FROM node:20-alpine AS build
WORKDIR /app

# Les dépendances d'abord : cette couche n'est reconstruite que si
# package.json change, pas à chaque modification du code.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL vaut `/api` (voir .env.production) : l'application interroge sa
# propre origine, et nginx relaie vers le backend. Rien à reconstruire quand
# l'adresse du poste change.
RUN npm run build


FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
