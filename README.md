# ClinPGx CDSS — Sistema Hospitalar de Decisão Farmacogenômica (CPIC / FDA / DPWG)

[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC_BY--SA_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)
[![Clinical Standards](https://img.shields.io/badge/Standards-CPIC%20%7C%20FDA%20%7C%20DPWG-0284C7.svg)](#)
[![Interoperability](https://img.shields.io/badge/FHIR-HL7%20%2F%20CDS%20Hooks-10B981.svg)](#)

Repositório oficial e autônomo da plataforma **ClinPGx CDSS** (*Clinical Decision Support System*), construída a partir da engenharia reversa estrita do **PharmDOG** e das diretrizes do **ClinPGx** (Stanford University / NIH).

---

## 📑 Dossiês Técnicos e Manuais Oficiais em PDF

Os documentos executivos completos estão disponíveis na pasta [`docs/`](./docs/):

1. **[Manifesto Clínico, Auditoria REA & Guia Operacional de Produto](./docs/MANIFESTO_IMPACTO_E_USO_CLINICO.pdf)**  
   *Arquivo:* `docs/MANIFESTO_IMPACTO_E_USO_CLINICO.pdf` (4 páginas A4 diagramadas)  
   *Conteúdo:* Fundamentos dos 4 fenótipos do CYP450, fenoconversão, auditoria de confrontação contra o PharmDOG original, detalhamento das 4 otimizações, manual passo a passo de cada botão/tela, estudo PREPARE (*The Lancet*, 2023) e impacto em saúde pública.
2. **[Dossiê Técnico-Regulatório & Parecer Clínico](./docs/DOSSIE_LEGAL_E_CLINICO_CLINPGX.pdf)**  
   *Arquivo:* `docs/DOSSIE_LEGAL_E_CLINICO_CLINPGX.pdf` (2 páginas A4 diagramadas)  
   *Conteúdo:* Parecer sobre a licença aberta CC BY-SA 4.0 do NIH/Stanford, uso de APIs públicas, enquadramento como SaMD (Software as a Medical Device) perante Anvisa (RDC 657/2022) e Conselho Federal de Medicina (CFM).

---

## 🚀 Funcionalidades e Otimizações Implementadas

* **Visão Dupla de Navegação (Modo Duplo):** Alternância instantânea entre **Modo Avaliação de Paciente** (painel multigene) e **Modo Enciclopédia de Fármacos** (catálogo direto de 141 princípios ativos por classes terapêuticas).
* **Prontuário Simulado Multi-Pacientes:** Seletor local que gerencia perfis clínicos pré-carregados (*Dona Maria*, *Sr. João*, *Ana Clara*) e permite cadastrar e salvar novos pacientes com persistência instantânea no navegador (`LocalStorage`).
* **Régua Enzimática Visual (Activity Score Gauge):** Medidor cromático animado que posiciona o Escore de Atividade (Gaedigk et al., 0.0 a &ge;3.0) do paciente em tempo real.
* **Painel Multigene de 25 Farmacogenes:** Suporte completo aos 25 genes canônicos (CYP2D6, CYP2C19, DPYD, TPMT, VKORC1, HLA-B, etc.), incluindo alelos com variação no número de cópias (`*1x2`, `*1x≥3`, `*4x2`).
* **Detecção Automática de Fenoconversão:** Identificação de inibidores fortes de CYP2D6 (Fluoxetina, Paroxetina, Bupropiona) que transformam metabolizadores normais em lentos funcionais.
* **Motor Híbrido Dual GSI:** Conecta-se à API mestre oficial (`POST https://api.clinpgx.org/v1/site/gsi?view=most`) e possui fallback offline instantâneo para regras CPIC locais caso a rede oscile.
* **Interoperabilidade Hospitalar:** Gera links dinâmicos codificados (`?q=...`), Códigos QR móveis em vetor SVG e exporta pacotes de decisão clínica no padrão **HL7 FHIR / CDS Hooks**.

---

## 💻 Como Executar Localmente

### Opção 1: Sem Servidor (Duplo-clique)
Basta abrir o arquivo `index.html` ou `prototipo/prototype-clinpgx.html` diretamente em qualquer navegador moderno.

### Opção 2: Servidor Node Local
```bash
npm install
npm start
# Acesse no navegador: http://127.0.0.1:8088/
```

### Opção 3: Executar Testes Ontológicos
```bash
npm test
```

---

## ☁️ Deploy em Produção (Vercel)

Este repositório já contém a configuração oficial [`vercel.json`](./vercel.json).

1. Acesse [vercel.com/new](https://vercel.com/new).
2. Conecte sua conta do GitHub e importe este repositório.
3. O deploy é automático: a raiz `/` será roteada imediatamente para o protótipo funcional, com certificado SSL/HTTPS gratuito e disponibilidade global de 99.99%.

---

## 🗄️ Integração com Supabase (Configuração de Banco & Cache)

Para blindar o aplicativo contra o rate limit de 2 requisições por segundo da API pública do NIH, o Supabase atua como **Edge Cache Proxy**:

1. Crie um projeto no [supabase.com](https://supabase.com).
2. Crie a tabela de cache no SQL Editor:
   ```sql
   create table if not exists gsi_cache (
     id text primary key,
     genotype_hash text not null,
     response_payload jsonb not null,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null
   );
   ```
3. Defina as variáveis de ambiente:
   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-chave-anon-publica
   ```

---

## ⚖️ Conformidade Legal & Propriedade Intelectual

Os dados de referência clínica, associações alélicas e tabelas de pontuação de atividade são de patrimônio público científico aberto, mantidos pela **Stanford University** e pelo consórcio **CPIC**, financiados pelos **National Institutes of Health (NIH)** através das bolsas *U24 HG010615* e *R24 GM61374*, regulamentados sob a licença internacional **Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)**.
