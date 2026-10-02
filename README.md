# Tech Check

Portal de tecnologia em português, com notícias do mundo tech, curiosidades e história da tecnologia.

## Visão do projeto

O Tech Check será construído como um portal editorial automatizado. O sistema deverá:

1. Buscar notícias em fontes especializadas e feeds autorizados.
2. Identificar notícias repetidas sobre o mesmo acontecimento.
3. Cruzar informações de múltiplas fontes quando possível.
4. Traduzir e reescrever o conteúdo em português com linguagem natural e descontraída, sem inventar fatos.
5. Separar fatos confirmados, declarações de empresas e informações ainda não confirmadas.
6. Gerar uma seção separada de possíveis desdobramentos futuros, sempre identificada como análise/especulação.
7. Registrar e exibir as fontes originais e links para as matérias consultadas.
8. Usar imagens somente quando houver base legal/licença adequada, ou gerar imagens próprias quando necessário.

## Estrutura planejada

- `index.html` — página inicial do MVP.
- `styles.css` — identidade visual e responsividade.
- `app.js` — camada inicial de apresentação.
- `data/` — dados normalizados das notícias.
- `api/` — endpoints e serviços do backend.
- `worker/` — coleta, deduplicação e processamento das fontes.
- `.github/workflows/` — automações de atualização.

## Próxima etapa

Implementar o pipeline de ingestão RSS e o modelo de dados para notícias/fontes. A publicação automática só deverá ocorrer depois das etapas de deduplicação, verificação e geração do texto.
