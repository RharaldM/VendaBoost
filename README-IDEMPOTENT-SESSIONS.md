# Sistema de Persistência Idempotente para Sessões do Facebook

## Fluxo Final

1. **Extração**: Content script detecta mudanças e envia dados via background
2. **Canonicalização**: Background converte dados para estado canônico v1 (userId, cookies essenciais, deviceHint)
3. **Hash**: Calcula hash estável do estado canônico
4. **Idempotência**: Se hash igual ao anterior, não envia para servidor
5. **Compare-and-Swap**: Servidor verifica conflitos usando prevHash
6. **Persistência**: Salva snapshot único por hash + atualiza ponteiro canônico
7. **Limpeza**: Remove snapshots antigos (TTL 3 dias, máximo 3 versões)

## Estrutura de Armazenamento

```
data/
├── sessions/{userId}/
│   ├── {hash1}.json    # Snapshot de sessão
│   ├── {hash2}.json    # Snapshot de sessão
│   └── {hash3}.json    # Snapshot de sessão
└── current/{userId}.json  # Ponteiro canônico
```

**Ponteiro canônico**: `{"hash": "abc123", "timestamp": 1234567890}`
**Snapshot**: Estado canônico completo + metadados originais

## Teste Manual

1. **Iniciar servidor**: `npm run dev` (porta 3000)
2. **Carregar extensão**: Chrome Developer Mode
3. **Acessar Facebook**: Login em conta válida
4. **Verificar snapshot**: Deve aparecer em `data/sessions/{userId}/{hash}.json`
5. **Recarregar página**: Não deve criar novo snapshot (hash idêntico)
6. **Trocar conta/logout**: Deve criar novo snapshot com hash diferente
7. **Múltiplas abas**: Não deve duplicar snapshots (CAS previne corridas)
8. **Aguardar TTL**: Snapshots antigos removidos após 3 dias

## Logs Esperados

- `✅ Novo snapshot salvo: {hash}`
- `ℹ️ Snapshot já existe: {hash}`
- `⚠️ Conflito CAS detectado`
- `🗑️ Removido snapshot antigo: {hash}`