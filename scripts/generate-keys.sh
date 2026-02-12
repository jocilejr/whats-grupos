#!/bin/bash
# Gera ANON_KEY e SERVICE_ROLE_KEY a partir de um JWT_SECRET
# Uso: ./generate-keys.sh <JWT_SECRET>

JWT_SECRET="$1"

if [ -z "$JWT_SECRET" ]; then
  echo "Uso: $0 <JWT_SECRET>" >&2
  exit 1
fi

# Funcao para gerar JWT usando Node.js
generate_jwt() {
  local ROLE="$1"
  local SECRET="$2"
  
  node -e "
    const crypto = require('crypto');
    
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      role: '${ROLE}',
      iss: 'supabase',
      iat: now,
      exp: now + (10 * 365 * 24 * 60 * 60) // 10 years
    };
    
    function base64url(obj) {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_');
    }
    
    const segments = base64url(header) + '.' + base64url(payload);
    const signature = crypto
      .createHmac('sha256', '${SECRET}')
      .update(segments)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\\+/g, '-')
      .replace(/\\//g, '_');
    
    console.log(segments + '.' + signature);
  "
}

ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

echo "ANON_KEY=${ANON_KEY}"
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
