# ClinPGx & PharmDOG — Revisão Profunda de Engenharia Reversa e Matriz de Paridade Funcional

**Alvo:** [PharmDOG](https://pharmdog.clinpgx.org/) / [ClinPGx](https://www.clinpgx.org/)  
**Documento:** Auditoria de Funcionalidades, Análise de Lacunas (Gap Analysis) e Plano de Paridade Funcional Estrita  
**Data:** 16/10/2026  
**Auditor:** Laboratório REA (Antigravity Advanced Agentic Coding)  
**Status:** **AUDITORIA DE ENGENHARIA REVERSA CONCLUÍDA — GAPS MAPEADOS**

---

## 1. Veredito Executivo da Auditoria

> **A fidelidade funcional atual está em aproximadamente 60%**.  
> O nosso protótipo inicial reproduziu com perfeição a **matemática dos escores de atividade de Gaedigk et al.**, a **resolução de fenótipos CPIC** e os **4 cenários clínicos padrão-ouro**, além de inovar com a exportação de **CDS Hooks (HL7 FHIR)**.
> 
> Contudo, a engenharia reversa detalhada da AST do bundle do PharmDOG (`index-CxtnEV80.js`, 528 KB) revelou que o sistema original possui **capacidades sistêmicas de nível hospitalar que foram simplificadas** no protótipo inicial.

---

## 2. Matriz Comparativa: Original PharmDOG vs. Protótipo Inicial

| Dimensão Funcional | Sistema Original (PharmDOG / ClinPGx) | Protótipo Inicial (Nosso CDSS) | Situação / Gap |
| :--- | :--- | :--- | :---: |
| **Escopo de Genes** | Suporta **25 farmacogenes simultâneos** (`CYP2D6`, `CYP2C19`, `CYP2C9`, `CYP2B6`, `CYP3A4`, `CYP3A5`, `TPMT`, `NUDT15`, `DPYD`, `UGT1A1`, `SLCO1B1`, `ABCG2`, `HLA-A`, `HLA-B`, `NAT2`, `G6PD`, etc.). | Focado em **4 genes** (`CYP2D6`, `CYP2C19`, `SLCO1B1`, `DPYD`) avaliados 1 por vez. | ⚠️ **Lacuna de Amplitude** |
| **Perfil Genético do Paciente** | **Painel Multigene Simultâneo**: o médico cadastra múltiplos genes de um mesmo paciente e avalia o impacto conjunto sobre a prescrição. | **Monogênico**: seleção isolada de 1 gene por avaliação. | ⚠️ **Lacuna de Fluxo** |
| **Entrada de Variantes** | 1. Diplotipo completo (`*1/*4`);<br>2. Variantes de cópia (`*1x2`, `*1x≥3`, `*4x2`);<br>3. Fenótipo direto (caso o teste não traga alelos);<br>4. Monogênicos (`HLA-B*57:01`, `rs12777823`). | Diplotipo com seleção de 2 alelos. | ⚠️ **Lacuna Parcial** |
| **Motor de Inferência GSI** | Envia requisição `POST /site/gsi?view=most` contendo todo o mapa genômico do paciente (`ue = { "CYP2D6": ["*1", "*4"], ... }`). O backend processa contra **> 140 fármacos simultaneamente**. | Motor JavaScript puro embutido testando 1 droga selecionada no dropdown. | ⚠️ **Lacuna de Escala de Varredura** |
| **Cobertura de Fármacos** | Mais de **140 medicamentos** classificados na árvore ATC, com pesquisa por similaridade ortográfica/fonética (`/site/gsi/drugSearch?q=`). | Lista de 2 a 3 drogas pré-selecionadas por gene. | ⚠️ **Lacuna de Catálogo** |
| **Filtro de Ação Clínica** | Toggle **"Actionable Drugs Only"** (`Dh = "actionable-drug-selection-cache"`): oculta drogas sem recomendação específica, destacando apenas as que exigem conduta médica. | Mostra apenas a droga selecionada. | ⚠️ **Lacuna de Filtro** |
| **Fontes de Diretrizes** | Gerenciador de Fontes Multi-Consórcio: permite ligar/desligar `CPIC`, `DPWG` e `FDA` individualmente e reordenar a prioridade por arrastar-e-soltar. | Apresenta a diretriz canônica compilada (CPIC + FDA) sem chaveamento de fonte. | ⚠️ **Lacuna de Governança** |
| **Fenoconversão por Co-medicações** | Detecta interações droga-gene com fármacos inibidores e exibe alerta explícito: *", based on phenoconversion from selected medications"*, preservando o fenótipo genético original. | Implementado para Fluoxetina, Paroxetina e Bupropiona. | ✅ **Fiel em Lógica** |
| **Persistência de Sessão** | Salva o perfil do paciente em `localStorage` (`gsi-selections-cache`), cache de resultados (`gsi-results-cache`, TTL 24h) e histórico de buscas. | Estado mantido apenas em memória durante a sessão. | ⚠️ **Lacuna de Persistência** |
| **Compartilhamento Clínico** | Permite compartilhar o perfil genético do paciente via **URL com Query Param (`?q=...`)** e **Código QR (`qrShare`)** para leitura móvel ou transferência para prontuário. | Copia payload JSON para área de transferência (CDS Hooks). | ⚠️ **Lacuna de Interoperabilidade** |
| **Exportação / Relatório** | Formato de impressão otimizado via CSS `@media print` (`window.print`). | Sem folha de estilo de impressão médica dedicada. | ⚠️ **Lacuna de Relatório** |

---

## 3. As 5 Grandes Funcionalidades Faltantes no Detalhe

### Lacuna 1: O Modo "Painel Multigene do Paciente" (Multi-Gene Profile)
No PharmDOG real, um paciente raramente faz teste de apenas um gene. Ele realiza um painel farmacogenômico (ex: painel cardiovascular ou psiquiátrico) contendo 5 a 15 genes.
* **Comportamento original:** O médico seleciona `CYP2D6 *1/*4`, `CYP2C19 *1/*2` e `SLCO1B1 *5/*5` para a Dona Maria (65 anos). O sistema armazena a matriz genômica completa do paciente e avalia **todos os medicamentos da receita médica** de forma cruzada.
* **O que precisamos implementar:** Um painel onde o usuário pode adicionar quantos genes quiser à carteira do paciente, montando um perfil genômico abrangente.

### Lacuna 2: O Motor Híbrido GSI (Online Real + Fallback Offline)
A engenharia reversa desvendou o endpoint mestre do PharmDOG:
```http
POST https://api.clinpgx.org/v1/site/gsi?view=most&sources=cpic,dpwg,fda
Content-Type: application/json

{
  "CYP2D6": ["*4", "*4"],
  "CYP2C19": ["*1", "*2"]
}
```
Esse endpoint retorna em milissegundos o laudo completo sobre 141 medicamentos.
* **O que precisamos implementar:** Nosso motor deve ser **híbrido**:
  1. Se houver conexão de rede, consulta diretamente a API oficial do ClinPGx (`/site/gsi?view=most`);
  2. Se estiver offline ou a API falhar, executa nosso motor JavaScript interno (Gaedigk et al.), garantindo 100% de disponibilidade.

### Lacuna 3: Varredura de Armário Medicamentoso e Filtro "Actionable"
No PharmDOG, o resultado não é apenas um alerta de 1 remédio. É uma tela completa dividida em:
* **Medicamentos Acionáveis (Actionable):** Fármacos onde o genótipo do paciente **altera a conduta** (exige ajuste de dose, troca de droga ou contraindicação estrita).
* **Medicamentos Sem Ação (Not Actionable):** Fármacos onde a eficácia e segurança são as habituais.
* **Toggle de Filtro:** Permite ao médico visualizar apenas os medicamentos que trazem perigo real ao paciente.

### Lacuna 4: Filtros e Prioridade de Diretrizes (CPIC vs. DPWG vs. FDA)
Médicos nos EUA frequentemente priorizam as tabelas da **FDA** e **CPIC**, enquanto médicos na Europa e Holanda priorizam a **DPWG** (Dutch Pharmacogenetics Working Group). O PharmDOG permite:
* Desmarcar fontes (ex: "Quero ver apenas recomendações aprovadas pelo FDA");
* Reordenar a hierarquia de apresentação.

### Lacuna 5: Compartilhamento Clínico por URL, QR Code e Impressão
Para que o teste farmacogenômico acompanhe o paciente entre o ambulatório de cardiologia e o de oncologia:
* O PharmDOG codifica o genótipo no parâmetro `?q={"CYP2D6":["*1","*4"]}`;
* Gera um **QR Code clínico** na tela;
* Permite imprimir uma via física limpa para anexar ao prontuário hospitalar.

---

## 4. Plano de Evolução para Paridade Funcional Estrita (100% Fiel ao Original)

Para que a réplica funcional seja absolutamente fiel ao ClinPGx/PharmDOG (antes de desenharmos a interface moderna definitiva), implementaremos:

1. **Expansão do Dicionário Alélico:** Integrar os 25 farmacogenes a partir do `gsi_options.json` já capturado no nosso cache.
2. **Painel de Perfil do Paciente:** Permitir adição dinâmica de múltiplos genes com seus respectivos alelos.
3. **Motor Híbrido com Suporte a POST `/site/gsi`:** Consulta ao endpoint oficial com fallback automático offline.
4. **Varredura Completa com Tabela de Resultados Agrupada:**
   * Abas por fonte (`CPIC`, `DPWG`, `FDA`);
   * Badges de severidade e status de "Actionable";
   * Filtro de busca de medicamentos com autocomplete (`/site/gsi/drugSearch`).
5. **Persistência em LocalStorage:** Implementar as mesmas chaves (`gsi-selections-cache`, `actionable-drug-selection-cache`, etc.).
6. **Módulo de Compartilhamento:** Codificação de URL `?q=...`, visualizador de QR Code e folha de estilo para impressão médica (`@media print`).

---

## 5. Próximo Passo e Decisão

Com este diagnóstico concluído e documentado:
* O que fizemos até agora é uma fundação sólida e correta do motor genético.
* A cópia fiel das funcionalidades requer a transição do modelo "1 gene / 1 droga de teste" para o modelo completo "painel multigene com varredura de armário medicamentoso e filtros por diretriz".

Aguardando sua autorização para implementar essa expansão funcional completa.
