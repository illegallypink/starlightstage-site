# Serves the Starlight Stage karaoke game (karaoke/) as a static site with nginx.
FROM nginx:alpine
COPY karaoke/index.html karaoke/style.css karaoke/app.js karaoke/songs.js /usr/share/nginx/html/
EXPOSE 80
