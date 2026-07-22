# Stage 1: generate a self-signed ECDSA P-256 certificate with SubjectAltName
# so modern browsers accept it. In production, replace this stage by mounting
# a real certificate (Let's Encrypt / your CA) as a Docker secret instead.
FROM alpine:3.21 AS certs
RUN apk add --no-cache openssl && \
    openssl req -x509 \
      -newkey ec \
      -pkeyopt ec_paramgen_curve:P-256 \
      -keyout /tmp/tls.key \
      -out /tmp/tls.crt \
      -days 365 \
      -nodes \
      -subj "/CN=domovault.local/O=Domovault/C=GB" \
      -addext "subjectAltName=DNS:domovault.local,DNS:localhost,IP:127.0.0.1"

# Stage 2: minimal nginx runtime with the generated certificate
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=certs /tmp/tls.crt /etc/nginx/ssl/tls.crt
COPY --from=certs /tmp/tls.key /etc/nginx/ssl/tls.key
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- --no-check-certificate https://localhost/api/health || exit 1
