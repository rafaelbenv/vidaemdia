# 55 — CI completo: build das imagens e verificação de vulnerabilidades (roteiro 7.9, item S10 parte 2)

## Objetivo
Além de lint, build e testes (já existem), o CI passa a construir as imagens Docker do backend e do front e a examiná-las com o Trivy.
- Vulnerabilidade **CRITICAL com correção disponível** → o CI falha.
- **HIGH** → aparece no relatório, mas não falha (imagens base às vezes têm HIGH sem correção ainda; travar por isso deixaria o CI vermelho sem ação possível).

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivo
- Editar: `.github/workflows/ci.yml` (acrescentar um job; não mudar os existentes)
- Editar: `README.md` (uma linha sobre o CI)

## Passos
1. Novo job `images` em `ci.yml`, depois dos outros (`needs: [frontend, backend]`), `runs-on: ubuntu-latest`, com `strategy.matrix.service: [backend, frontend]`
   e nome `Imagem ${{ matrix.service }} (build e Trivy)`:
   ```yaml
   steps:
     - uses: actions/checkout@v4
     - uses: docker/setup-buildx-action@v3
     - name: Build da imagem
       uses: docker/build-push-action@v6
       with:
         context: ./${{ matrix.service }}
         load: true
         push: false
         tags: vidaemdia-${{ matrix.service }}:ci
         cache-from: type=gha,scope=${{ matrix.service }}
         cache-to: type=gha,mode=max,scope=${{ matrix.service }}
     - name: Relatório de vulnerabilidades (HIGH e CRITICAL)
       uses: aquasecurity/trivy-action@v0.35.0
       with:
         image-ref: vidaemdia-${{ matrix.service }}:ci
         scanners: vuln
         severity: HIGH,CRITICAL
         ignore-unfixed: true
         format: table
         exit-code: '0'
     - name: Bloquear CRITICAL com correção disponível
       uses: aquasecurity/trivy-action@v0.35.0
       with:
         image-ref: vidaemdia-${{ matrix.service }}:ci
         scanners: vuln
         severity: CRITICAL
         ignore-unfixed: true
         format: table
         exit-code: '1'
         skip-setup-trivy: true
   ```
2. `README.md`, onde fala do CI (ou numa linha nova): "O CI roda lint, build e testes do backend e do front, constrói as imagens Docker e as examina com o Trivy (falha com vulnerabilidade crítica que já tem correção)."

## Critérios de aceite
- YAML válido; os jobs `frontend` e `backend` continuam iguais.
- No GitHub, o job `images` roda para as duas imagens (o revisor confere depois do push).

## O que NÃO alterar
- Dockerfiles, código, os jobs existentes.
