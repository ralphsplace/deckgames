FROM alpine:3.20 AS site
COPY . /src
# strip Windows line endings first, in case a checkout converted them (git core.autocrlf)
RUN cd /src && sed -i 's/\r$//' site.sh && sh site.sh /site

FROM nginx:1.27-alpine
COPY --from=site /site /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
