# ClinPGx — Dossiê de Engenharia Reversa Avançada e Arquitetura Clínica (REA)

**Documento:** Plano Otimizado de Engenharia Reversa, Mapeamento Ontológico e Prototipação CDSS  
**Alvo:** [ClinPGx](https://www.clinpgx.org/) (Clinical Pharmacogenomics Resource — NIH / Stanford)  
**API Pública Canônica:** `https://api.clinpgx.org/v1/` (CC-BY-SA-4.0)  
**Workspace Exclusivo:** `C:\Users\merca\REA-Laboratorio\clinpgx\`  
**Data:** 15/10/2026 (Atualizado: 16/10/2026)  
**Status:** **FASES 1 E 2 CONCLUÍDAS COM SUCESSO (COLHEITA DE ONTOLOGIAS E REA DO PHARMDOG)**  

---

## 1. Confrontação Crítica: Plano Anterior vs. Metodologia Otimizada

Ao analisar a natureza real do **ClinPGx**, identificamos que tratá-lo com a abordagem comum de scraping de frontend (como fizemos no Anota AI ou Mio Bello) seria um erro tático. O ClinPGx não é um aplicativo transacional fechado; ele é um **recurso de bioinformática e conhecimento clínico** com governança do NIH e padrões internacionais (CPIC, PharmCAT, ClinGen).

### Matriz de Confrontação e Otimização:

| Dimensão | Abordagem Anterior (Ingênua) | Abordagem Otimizada (State of the Art) | Vantagem Competitiva / Racional Técnico |
| :--- | :--- | :--- | :--- |
| **Abordagem Central** | Extrair telas e dados raspando o DOM da SPA React com CDP. | **Framework Dual-Track:** Extração ontológica canônica via API REST + Análise de AST e seletores via REA. | O frontend é apenas a casca visual. A verdade dos dados e das regras genéticas está na API pública aberta. |
| **Integridade de Dados** | Sujeita a cortes de texto, formatação e paginação visual. | **Consumo Direto de Schemas JSON/JSON-LD** com identificadores canônicos (`PA128`, `PA450801`). | Elimina ruídos de scraping, capturando identificadores estáveis (HGVS, RSID, InChI, PMCID). |
| **Controle de Rede** | Risco de bloqueio por HTTP 429 na API do ClinPGx. | **Coleta com Token Bucket Rate Limiter (teto de 2 req/s)** e Cache Local durável em JSON. | Respeita a política de uso do NIH/Stanford e garante que o laboratório funcione 100% offline após a colheita inicial. |
| **Foco da Análise REA** | Prints e árvores de acessibilidade genéricas. | **Análise de AST (`analyze_web_bundle`) focada nos chunks de domínio** (`gene-*.js`, `guidelineAnnotation-*.js`, `allele-*.js`). | Revela a lógica de cliente para montagem de diplotipos, fenoconversão por interações medicamentosas e visualização de vias. |
| **Arquitetura do Protótipo** | Um simulador genérico de pedidos/produtos. | **Motor de Apoio à Decisão Clínica (CDSS)** baseado no **Escore de Atividade CPIC (Gaedigk et al.)**. | Produz um protótipo genuinamente útil para farmacogenômica, calculando Activity Score e emitindo alertas padrão CDS Hooks. |
| **Governança de Workspace** | Arquivos na raiz do laboratório. | **Isolamento Hermético em `clinpgx/`** com manifesto SHA-256 e subdiretórios estritos. | Blindagem completa contra contaminação com os sistemas de Food Service anteriores. |

---

## 2. A Tríade Farmacogenômica: O Modelo Conceitual do ClinPGx

A engenharia reversa do ClinPGx precisa mapear e reproduzir com rigor matemático e biológico a cadeia de inferência clínica padronizada pelo CPIC:

```mermaid
graph LR
    subgraph 1. Perfil Genético do Paciente
        G[Gene: CYP2D6] --> A1[Alelo Materno: *1]
        G --> A2[Alelo Paterno: *4]
        A1 & A2 --> DIP[Diplotipo: *1/*4]
    end

    subgraph 2. Escore de Atividade (CPIC)
        DIP --> AS[Activity Score = 1.0 + 0.0 = 1.0]
        AS --> PHEN[Fenótipo: Metabolizador Intermediário - IM]
    end

    subgraph 3. Contexto Farmacológico
        MED[Prescrição Médica: Codeína 30mg] --> RX[Motor de Inferência CPIC]
        PHEN --> RX
    end

    subgraph 4. Decisão Clínica (CDS Alert)
        RX --> ALERT[ALERTA: Redução substancial de eficácia analgésica]
        RX --> REC[RECOMENDAÇÃO: Evitar codeína; prescrever analgésico não-CYP2D6 ex: Morfina ou AINE]
    end
```

### O Sistema de Escore de Atividade (Activity Score - AS):
* **Alelo de Função Normal (ex: `*1`, `*2`):** Valor = `1.0`
* **Alelo de Função Reduzida (ex: `*9`, `*17`, `*41`):** Valor = `0.5`
* **Alelo de Função Reduzida Severa (ex: `*10`):** Valor = `0.25`
* **Alelo Sem Função / Nulo (ex: `*3`, `*4`, `*5`):** Valor = `0.0`
* **Duplicações Gênicas (ex: `*1xN`, `*2xN`):** Multiplicação direta do valor do alelo pelo número de cópias.

$$\text{Activity Score (AS)} = \text{Valor}(\text{Alelo}_1) + \text{Valor}(\text{Alelo}_2)$$

| Activity Score | Fenótipo CPIC Padronizado | Conduta Terapêutica (Prodrogas ex: Codeína) |
| :---: | :---: | :--- |
| **0.0** | **Poor Metabolizer (PM)** | Ineficaz (não converte em morfina). Contraindicado. |
| **0.25 a 1.0** | **Intermediate Metabolizer (IM)** | Resposta reduzida. Monitorar ou trocar medicamento. |
| **1.25 a 2.25** | **Normal Metabolizer (NM)** | Resposta esperada. Seguir bula padrão. |
| **> 2.25** | **Ultrarapid Metabolizer (UM)** | Conversão acelerada em morfina. Risco letal de toxicidade. |

---

## 3. O Plano de Execução em 5 Fases Otimizadas

### Fase 1: Análise de AST e Deobfuscação do Frontend via REA
* **Alvo no Navegador:** `https://www.clinpgx.org/`
* **Mecanismo:** Chrome CDP port 9222 -> Servidor MCP REA.
* **Operações:**
  * `rea/list_browser_targets`: Conexão com a página aberta.
  * `rea/inspect_web_page`: Extração da árvore DOM, componentes de busca e armazenamento de sessão.
  * `rea/analyze_web_bundle`: Análise de AST sobre os chunks de domínio:
    * `/assets/gene-*.js` (seleção e renderização de tabelas de alelos);
    * `/assets/guidelineAnnotation-*.js` (renderização das recomendações CPIC);
    * `/assets/pathway-*.js` (estruturas de nós e arestas de vias bioquímicas).
  * `rea/capture_web_screenshot`: Registro probatório em alta resolução das interfaces de Gene e Diretriz.

### Fase 2: Mapeamento de Contratos e Colheita de Dados Canônicos
* **Alvo:** `https://api.clinpgx.org/v1/`
* **Pipeline de Coleta com Proteção de Rate Limit:**
  * Script Node.js com atraso controlado (600 ms entre chamadas = ~1.6 req/s) gravando em `clinpgx/artefatos/api_cache/`.
* **Subconjunto de Alto Impacto Clínico Selecionado para o Piloto:**
  1. **Genes Principais:**
     * `CYP2D6` (`PA128`): Analgésicos opioides (Codeína, Tramadol), antidepressivos tricíclicos, Tamoxifeno.
     * `CYP2C19` (`PA124`): Antiplaquetários (Clopidogrel), inibidores de bomba de prótons (Omeprazol), antidepressivos (Citalopram).
     * `SLCO1B1` (`PA134`): Toxicidade por Estatinas (Sinvastatina e risco de rabdomiólise/miopatia).
     * `DPYD` (`PA145`): Quimioterápicos fluoropirimidinas (5-Fluorouracil, Capecitabina e risco de toxicidade fatal).
  2. **Diretrizes CPIC Vinculadas:** Extração integral das matrizes de recomendação em JSON canônico.

### Fase 3: Engenharia Reversa da Resolução de Diplotipo e Fenótipo
* Desconstruir as matrizes de mapeamento diplotipo $\to$ fenótipo fornecidas pelas tabelas do CPIC/PharmGKB.
* Mapear o tratamento de casos ambíguos:
  * Variantes de significado incerto (VUS);
  * Indisponibilidade de teste para alelos raros;
  * Fenoconversão por interações droga-droga (ex: paciente geneticamente Normal para CYP2D6 tomando Fluoxetina torna-se fenotipicamente um Metabolizador Lento).

### Fase 4: Construção do Protótipo CDSS (Clinical Decision Support System)
* **Local:** `clinpgx/prototipo/prototype-clinpgx.html`
* **Diretriz:** Skill `prototype` (Modo `LOGIC.md`).
* **Arquitetura:**
  * Arquivo único HTML autocontido executável offline por duplo clique no Windows.
  * Módulo de domínio puro `<script id="domain-logic">` com `clinPgxDecisionEngine(patientGenotype, prescribedDrug)`.
  * Calculador do Activity Score em tempo real.
  * Emissor de Alertas Clínicos com severidade visual (Verde: Seguro, Amarelo: Ajuste de Dose, Vermelho: Contraindicado/Tóxico).
  * 4 Cenários Guiados de Casos Clínicos Reais:
    1. Paciente oncológico em dor: prescrição de Codeína para metabolizador pobre de CYP2D6.
    2. Paciente pós-infarto / stent: prescrição de Clopidogrel para metabolizador intermediário de CYP2C19.
    3. Paciente com colesterol alto: prescrição de Sinvastatina para variante de alto risco de SLCO1B1.
    4. Paciente com câncer colorretal: quimioterapia com 5-FU para variante nula de DPYD.

### Fase 5: Dossiê de Auditoria e Empacotamento de Evidências
* Exportação do feixe canônico `clinpgx/evidencias/clinpgx_evidence_bundle.json`.
* Geração do manifesto de integridade criptográfica `clinpgx/MANIFEST_SHA256.txt`.
* Elaboração do relatório de encerramento e validação de equivalência.

---

## 4. Evidências Coletadas nas Fases 1 e 2 (Resultados Oficiais)

### 4.1. Alvos e Telas Inspecionados no Chrome CDP (Porta 9222)
* **Home do ClinPGx (`https://www.clinpgx.org/`):**
  * Target ID: `2859365BBAC9D46918EAB85DC0873A5A`
  * Inspeção salva em: [clinpgx/evidencias/clinpgx_home_inspection.json](file:///C:/Users/merca/REA-Laboratorio/clinpgx/evidencias/clinpgx_home_inspection.json) (249 KB)
  * Screenshot salvo em: [clinpgx/artefatos/clinpgx_home.png](file:///C:/Users/merca/REA-Laboratorio/clinpgx/artefatos/clinpgx_home.png) (79 KB)
* **PharmDOG PWA (`https://pharmdog.clinpgx.org/`):**
  * Target ID: `EA6F56A5F950F8733B79C5259733F6FF`
  * Inspeção salva em: [clinpgx/evidencias/pharmdog_inspection.json](file:///C:/Users/merca/REA-Laboratorio/clinpgx/evidencias/pharmdog_inspection.json) (44.6 KB)
  * Screenshot salvo em: [clinpgx/artefatos/pharmdog_home.png](file:///C:/Users/merca/REA-Laboratorio/clinpgx/artefatos/pharmdog_home.png) (46.5 KB)

### 4.2. Deobfuscação e Análise Estática de AST do Bundle JS
* **Bundle:** `https://pharmdog.clinpgx.org/assets/index-CxtnEV80.js` (528 KB, 143.207 nós visitados na AST)
* **Evidência de AST:** [clinpgx/evidencias/pharmdog_bundle_analysis.json](file:///C:/Users/merca/REA-Laboratorio/clinpgx/evidencias/pharmdog_bundle_analysis.json)
* **Rotas da Aplicação Clínica Descobertas:**
  * `/` (Home com seleção e busca)
  * `/genotypes` (Seleção de alelos dos 25 farmacogenes)
  * `/drugs` (Navegação pela taxonomia ATC de medicamentos)
  * `/drugs/details/:chemicalId` (Visualização das diretrizes e alertas por medicamento)
  * `/results` (Resultados de compatibilidade e cálculo de fenótipos)
  * `/settings` e `/documentation`
* **Endpoints Reais Consumidos pelo Cliente:**
  1. `https://api.clinpgx.org/v1/site/gsi/options` (Dicionário de genes, alelos com duplicações `*1x2` / `*1x≥3`, e mapa de fenótipos)
  2. `https://api.clinpgx.org/v1/site/gsi/drugs` (Hierarquia completa de drogas ATC com flags de CPIC, DPWG e FDA)
  3. `https://api.clinpgx.org/v1/site/gsi/drugSearch?q={termo}` (Busca semântica de fármacos com escore de similaridade)
  4. `https://api.clinpgx.org/v1/site/chemical/{chemicalId}` (Metadados detalhados do fármaco, incluindo contraindicações RxNorm e diretrizes)
  5. `https://api.clinpgx.org/v1/data/guidelineAnnotation/{guidelineId}` (Texto canônico das diretrizes CPIC)

### 4.3. Cache Local de Dados Ontológicos (Funcionamento Offline Seguro)
Arquivos salvos em [clinpgx/artefatos/api_cache/](file:///C:/Users/merca/REA-Laboratorio/clinpgx/artefatos/api_cache/):
* `gsi_options.json` (37.9 KB — 25 genes, todos os alelos e fenótipos)
* `gene_CYP2D6.json` (4.6 KB)
* `gene_CYP2C19.json` (4.5 KB)
* `gene_SLCO1B1.json` (3.9 KB)
* `gene_DPYD.json` (3.3 KB)
* `chemical_codeine.json` (16.5 KB — Inclui contraindicações e avisos de caixa preta FDA para ultrarrápidos e pobres)
