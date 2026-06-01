FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy landing page files
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY i18n.js /usr/share/nginx/html/
COPY favicon.svg favicon-dark.svg icon.svg /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
