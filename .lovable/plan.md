

# Corrigir limpeza de depends_on vazios no install.sh

## Problema

Os comandos `sed` para remover blocos `depends_on:` que ficaram vazios apos a remoção do `analytics` não estão funcionando corretamente. Isso deixa YAML invalido como:

```yaml
studio:
    depends_on:
    environment:
      ...
```

O Docker Compose interpreta `depends_on:` seguido de nada como um valor vazio (deve ser array ou mapa), causando erro de validação.

## Solução

Substituir os comandos `sed` complexos de limpeza (linhas 350-356) por um script Python3 inline que processa o arquivo linha a linha e remove qualquer bloco `depends_on:` que ficou sem filhos. Python3 ja esta disponivel no servidor (pre-requisito do Docker).

### Mudanca no install.sh (linhas 350-356)

Remover:
```bash
for _i in 1 2 3; do
  sed -i -E '/^\s+depends_on:\s*$/{N;/^\s+depends_on:\s*\n\s+(condition:|[a-zA-Z_]+:\s*$)/!d}' docker-compose.yml 2>/dev/null || true
done
sed -i '/^\s*depends_on:\s*$/{N;/\n\s*(environment|ports|volumes|restart|healthcheck|image|container_name|command):/{ s/\s*depends_on:\s*\n/\n/; }}' docker-compose.yml 2>/dev/null || true
```

Substituir por:
```bash
python3 -c "
import re
with open('docker-compose.yml') as f:
    lines = f.readlines()
result = []
i = 0
while i < len(lines):
    # Check if this line is 'depends_on:' with nothing after the colon
    if re.match(r'^(\s+)depends_on:\s*$', lines[i]):
        indent = len(re.match(r'^(\s+)', lines[i]).group(1))
        # Check if next line exists and is at same or lower indent (not a child)
        if i + 1 >= len(lines) or not re.match(r'^\s{' + str(indent + 1) + r',}', lines[i + 1]):
            # Empty depends_on block - skip this line
            i += 1
            continue
    result.append(lines[i])
    i += 1
with open('docker-compose.yml', 'w') as f:
    f.writelines(result)
"
```

Esta abordagem:
- Le o arquivo linha a linha
- Quando encontra `depends_on:` (sem valor inline), verifica se a proxima linha tem indentação maior (filho)
- Se não tem filho, remove a linha `depends_on:` inteiramente
- Funciona independente do nivel de indentação ou nome do servico
