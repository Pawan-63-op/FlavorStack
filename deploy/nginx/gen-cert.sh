set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Self-signed cert written to $CERT_DIR (privkey.pem + fullchain.pem)."
