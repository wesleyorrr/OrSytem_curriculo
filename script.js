/* ============================================================
   OR SYSTEM — CURRÍCULO INTELIGENTE
   script.js  (Etapas A + B + C + D integradas)
   ------------------------------------------------------------
   Motor determinístico, 100% local. Sem IA generativa, sem APIs.
   Toda classificação é baseada em regras explícitas e auditáveis.
   Limitações declaradas no README.
   ============================================================ */

'use strict';

/* ============================================================
   1. ESTADO CENTRAL
   ============================================================ */
const state = {
  resumeOriginal: '',
  resumeEdited: '',
  job: '',
  profileData: null,
  jobData: null,
  analysis: null,
  scoreInfo: null,
  questions: [],
  hasAnalyzed: false
};

/* ============================================================
   2. DADOS DE EXEMPLO
   ============================================================ */
const samples = {
  resume: `João da Silva
São Paulo, SP | (11) 90000-0000 | joao.silva@email.com
linkedin.com/in/joaosilva

RESUMO
Analista de dados com 3 anos de experiência em análise de indicadores, criação de dashboards e apoio à tomada de decisão. Perfil analítico, organizado e voltado para resultados.

FORMAÇÃO
Bacharelado em Estatística — Universidade de São Paulo (USP)
Conclusão: 2021

EXPERIÊNCIA PROFISSIONAL
Analista de Dados Júnior — Empresa Exemplo Ltda.
Jan 2022 — Atual
- Construção de relatórios em Excel e Power BI para acompanhamento de metas.
- Consultas SQL para extração e tratamento de dados.
- Apoio à área de negócio na interpretação de indicadores.

Estagiário de Dados — Outra Empresa S.A.
Mar 2021 — Dez 2021
- Apoio na limpeza de bases e organização de planilhas.
- Elaboração de relatórios simples para a equipe.

COMPETÊNCIAS
Excel avançado, SQL, Power BI, Estatística descritiva, Organização, Comunicação.

IDIOMAS
Português (nativo), Inglês (intermediário).`,

  job: `Vaga: Analista de Dados Pleno

Requisitos:
- Experiência com análise de dados e construção de dashboards.
- Domínio de SQL para consultas em bancos relacionais.
- Conhecimento em Power BI ou ferramenta similar.
- Excel avançado.
- Capacidade de traduzir dados em insights para a área de negócio.
- Boa comunicação e organização.
- Inglês intermediário para leitura de documentação.
- Desejável: conhecimento em Python para análise de dados.
- Desejável: experiência com estatística aplicada.`
};

/* ============================================================
   3. UTILITÁRIOS
   ============================================================ */
const utils = {
  normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  },

  escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  tokenize(text) {
    const stopwords = new Set([
      'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na',
      'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'sem',
      'sob', 'sobre', 'entre', 'e', 'ou', 'mas', 'que', 'qual', 'quais', 'como',
      'se', 'sua', 'seu', 'suas', 'seus', 'meu', 'minha', 'meus', 'minhas',
      'ao', 'aos', 'the', 'and', 'or', 'of', 'to', 'in', 'for',
      'on', 'at', 'by', 'with', 'is', 'are', 'be', 'this', 'that', 'these',
      'those', 'it', 'its', 'an', 'from'
    ]);

    const normalized = utils.normalize(text)
      .replace(/[^a-z0-9\s+#.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return [];

    return normalized
      .split(' ')
      .filter((w) => w.length >= 3 && !stopwords.has(w));
  },

  contains(haystack, needle) {
    return utils.normalize(haystack).includes(utils.normalize(needle));
  },

  hasEmail(text) { return /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text); },
  hasPhone(text) { return /(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/.test(text); },
  hasLinkedin(text) { return /linkedin\.com\/in\/[\w-]+/i.test(text); },

  clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
};

/* ============================================================
   4. PROFILE — estruturação interna do currículo
   ------------------------------------------------------------
   LIMITAÇÕES DECLARADAS:
   - Heurística baseada em texto simples (sem IA, sem NLP externo).
   - Reconhece formatos comuns de currículo; formatos atípicos caem em `gaps`.
   - NÃO inventa dados ausentes.
   ============================================================ */
const profile = {
  headers: {
    resumo: ['resumo', 'objetivo', 'perfil profissional', 'sobre mim', 'resumo profissional'],
    formacao: ['formacao', 'formacao academica', 'educacao', 'escolaridade', 'graduacao'],
    experiencia: ['experiencia', 'experiencia profissional', 'experiencias', 'historico profissional', 'atuacao profissional'],
    competencias: ['competencias', 'habilidades', 'conhecimentos', 'competencias tecnicas', 'qualificacoes'],
    idiomas: ['idiomas', 'linguas'],
    certificacoes: ['certificacoes', 'certificados', 'cursos', 'formacao complementar'],
    projetos: ['projetos', 'projetos pessoais', 'projetos relevantes', 'portfolio', 'portifolio']
  },

  periodRegex: /((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*\d{2,4}|\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|a|até|ate)\s*((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*\d{2,4}|\d{1,2}\/\d{4}|\d{4}|atual|o momento|presente)/i,

  isHeader(line, keyList) {
    const t = utils.normalize(line.trim());
    if (!t || t.length > 50) return false;
    return keyList.some((h) => t === utils.normalize(h) || t.startsWith(utils.normalize(h) + ' '));
  },

  detectSection(line) {
    for (const [key, list] of Object.entries(this.headers)) {
      if (this.isHeader(line, list)) return key;
    }
    return null;
  },

  splitSections(text) {
    const lines = String(text || '').split(/\r?\n/);
    const buckets = { _topo: [] };
    for (const k of Object.keys(this.headers)) buckets[k] = [];

    let current = '_topo';
    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const trimmed = line.trim();
      if (!trimmed) { buckets[current].push(''); continue; }
      const detected = this.detectSection(trimmed);
      if (detected) { current = detected; continue; }
      buckets[current].push(line);
    }
    return buckets;
  },

  extractContact(topoLines) {
    const contact = { name: null, email: null, phone: null, linkedin: null, location: null, raw: [] };
    const nonEmpty = topoLines.map((l) => l.trim()).filter(Boolean);
    if (nonEmpty.length > 0) contact.name = nonEmpty[0];

    for (const line of nonEmpty) {
      if (!contact.email) {
        const m = line.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
        if (m) contact.email = m[0];
      }
      if (!contact.phone) {
        const m = line.match(/(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
        if (m) contact.phone = m[0];
      }
      if (!contact.linkedin) {
        const m = line.match(/linkedin\.com\/in\/[\w-]+/i);
        if (m) contact.linkedin = m[0];
      }
      if (!contact.location) {
        const m = line.match(/([A-Za-zÀ-ÿ\s]+)[,\-]\s?([A-Z]{2})\b/);
        if (m) contact.location = `${m[1].trim()} - ${m[2]}`;
      }
    }
    contact.raw = nonEmpty;
    return contact;
  },

  extractExperiences(expLines) {
    const experiences = [];
    const lines = expLines.filter((l, i, arr) => !(l.trim() === '' && arr[i - 1]?.trim() === ''));

    let current = null;
    const headerLike = (line) => {
      const t = line.trim();
      if (!t) return false;
      if (/\s(?:—|–|-)\s/.test(t) && t.length <= 120) return true;
      if (/\sna\s/i.test(t) && t.length <= 120) return true;
      if (/^empresa\s*:/i.test(t)) return true;
      return false;
    };

    const pushCurrent = () => {
      if (current && (current.title || current.bullets.length > 0)) {
        experiences.push(current);
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (current && current.bullets.length > 0) { pushCurrent(); current = null; }
        continue;
      }

      if (/^[-*•]\s+/.test(trimmed)) {
        if (!current) current = { title: null, company: null, period: null, bullets: [] };
        current.bullets.push(trimmed.replace(/^[-*•]\s+/, '').trim());
        continue;
      }

      const periodOnly = trimmed.match(this.periodRegex);
      if (current && periodOnly && trimmed.replace(this.periodRegex, '').trim().length === 0) {
        if (!current.period) current.period = trimmed;
        continue;
      }

      if (headerLike(trimmed)) {
        pushCurrent();
        current = { title: trimmed, company: null, period: null, bullets: [] };
        const m = trimmed.split(/\s(?:—|–|-)\s/);
        if (m.length >= 2) {
          current.title = m[0].trim();
          current.company = m.slice(1).join(' - ').trim();
        } else {
          const mNa = trimmed.match(/^(.*?)\s+na\s+(.*)$/i);
          if (mNa) {
            current.title = mNa[1].trim();
            current.company = mNa[2].trim();
          }
        }
        const p = trimmed.match(this.periodRegex);
        if (p) current.period = p[0];
        continue;
      }

      if (current && !current.period) {
        const p = trimmed.match(this.periodRegex);
        if (p) { current.period = p[0]; continue; }
      }

      if (current) current.bullets.push(trimmed);
    }

    pushCurrent();
    return experiences;
  },

  extractEducation(formLines) {
    const out = [];
    for (const raw of formLines) {
      const line = raw.trim();
      if (!line) continue;
      out.push(line.replace(/^[-*•]\s+/, '').trim());
    }
    return out;
  },

  extractSkills(skillLines) {
    const skills = new Set();
    for (const raw of skillLines) {
      let line = raw.trim();
      if (!line) continue;
      line = line.replace(/^[-*•]\s+/, '');
      const parts = line.split(/\s*[,;\/]\s*|\s+e\s+/i);
      for (const p of parts) {
        const t = p.trim();
        if (t.length >= 2 && t.length <= 60) skills.add(t);
      }
    }
    return [...skills];
  },

  extractLanguages(langLines) {
    const out = [];
    for (const raw of langLines) {
      const line = raw.trim().replace(/^[-*•]\s+/, '');
      if (!line) continue;
      const m = line.match(/^([A-Za-zÀ-ÿ\s]+)\s*[\(:\-–—]\s*([^)]+)\)?/);
      if (m) out.push({ language: m[1].trim(), level: m[2].trim() });
      else out.push({ language: line, level: null });
    }
    return out;
  },

  extractCerts(certLines) {
    const out = [];
    for (const raw of certLines) {
      const line = raw.trim().replace(/^[-*•]\s+/, '');
      if (line) out.push(line);
    }
    return out;
  },

  extractProjects(projectLines) {
    const out = [];
    let current = null;
    for (const raw of projectLines) {
      const line = raw.trim();
      if (!line) {
        if (current) { out.push(current); current = null; }
        continue;
      }
      if (/^[-*•]\s+/.test(line)) {
        if (!current) current = { title: null, bullets: [] };
        current.bullets.push(line.replace(/^[-*•]\s+/, '').trim());
      } else {
        if (current) out.push(current);
        current = { title: line, bullets: [] };
      }
    }
    if (current) out.push(current);
    return out;
  },

  parse(resumeText) {
    const text = String(resumeText || '');
    const buckets = this.splitSections(text);

    const contact = this.extractContact(buckets._topo);
    const experiences = this.extractExperiences(buckets.experiencia);
    const education = this.extractEducation(buckets.formacao);
    const skills = this.extractSkills(buckets.competencias);
    const languages = this.extractLanguages(buckets.idiomas);
    const certifications = this.extractCerts(buckets.certificacoes);
    const projects = this.extractProjects(buckets.projetos);

    const resumeLines = (buckets.resumo || []).map((l) => l.trim()).filter(Boolean);
    const summary = resumeLines.join(' ').trim() || null;

    const gaps = [];
    if (!contact.email) gaps.push('E-mail não identificado.');
    if (!contact.phone) gaps.push('Telefone não identificado.');
    if (!contact.linkedin) gaps.push('LinkedIn não identificado (opcional, mas recomendável).');
    if (experiences.length === 0) gaps.push('Nenhuma experiência profissional extraída do texto.');
    if (experiences.some((e) => !e.period)) gaps.push('Alguma experiência sem período informado.');
    if (experiences.some((e) => e.bullets.length === 0)) gaps.push('Alguma experiência sem atividades descritas.');
    if (education.length === 0) gaps.push('Formação acadêmica não identificada.');
    if (skills.length === 0) gaps.push('Competências não listadas em seção própria.');
    if (languages.length === 0) gaps.push('Idiomas não informados.');
    if (!summary) gaps.push('Resumo profissional não identificado.');

    const hasNumbers = experiences.some((e) =>
      e.bullets.some((b) => /\d+%|\d+\s*(mil|milh|k|reais|r\$)|aument|reduz|otimiz|economiz/i.test(b))
    );
    if (experiences.length > 0 && !hasNumbers) {
      gaps.push('Nenhum resultado mensurável (números/percentuais) foi identificado nas experiências.');
    }

    return {
      contact, summary, experiences, education, skills,
      languages, certifications, projects, gaps, raw: text
    };
  }
};

/* ============================================================
   5. JOBSPEC — estruturação interna da vaga
   ============================================================ */
const jobSpec = {
  requiredTriggers: [
    'requisito', 'obrigatorio', 'obrigatoria', 'necessario', 'necessaria',
    'imprescindivel', 'exigido', 'exigida', 'indispensavel', 'essencial'
  ],
  desiredTriggers: [
    'desejavel', 'diferencial', 'plus', 'sera um plus', 'sera um diferencial',
    'preferencial', 'preferencia', 'ideal', 'seria bom'
  ],

  behavioralDict: [
    'comunicacao', 'comunicativo', 'organizacao', 'organizado', 'proatividade',
    'proativo', 'trabalho em equipe', 'colaboracao', 'colaborativo', 'lideranca',
    'lider', 'empatia', 'resiliencia', 'adaptabilidade', 'flexibilidade',
    'criatividade', 'criativo', 'pensamento critico', 'resolucao de problemas',
    'autonomia', 'autonomo', 'comprometimento', 'responsabilidade', 'atencao a detalhes',
    'orientacao a resultados', 'foco em resultados', 'aprendizado continuo',
    'capacidade de aprender', 'gestao de tempo', 'priorizacao'
  ],

  toolsDict: [
    'excel', 'word', 'powerpoint', 'outlook', 'google sheets', 'google docs',
    'sql', 'mysql', 'postgresql', 'oracle', 'sql server', 'mongodb',
    'python', 'r', 'java', 'javascript', 'typescript', 'c#', 'c++', 'php', 'go', 'ruby',
    'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch',
    'power bi', 'tableau', 'looker', 'qlik', 'metabase', 'google data studio',
    'git', 'github', 'gitlab', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
    'jira', 'trello', 'notion', 'slack', 'figma', 'photoshop', 'illustrator',
    'sap', 'totvs', 'salesforce', 'hubspot', 'crm',
    'html', 'css', 'react', 'angular', 'vue', 'node', 'django', 'flask', 'spring',
    'etl', 'elt', 'airflow', 'dbt', 'spark', 'hadoop', 'kafka'
  ],

  responsibilityVerbs: [
    'analisar', 'construir', 'desenvolver', 'criar', 'gerenciar', 'gerir',
    'coordenar', 'liderar', 'planejar', 'executar', 'monitorar', 'acompanhar',
    'elaborar', 'implementar', 'otimizar', 'automatizar', 'documentar',
    'apoiar', 'realizar', 'conduzir', 'participar', 'colaborar', 'definir',
    'estruturar', 'avaliar', 'medir', 'reportar', 'apresentar', 'negociar'
  ],

  extractExperienceYears(text) {
    const m = text.match(/(\d+)\s*(?:\+|a)?\s*anos?(?:\s+de)?/i);
    return m ? parseInt(m[1], 10) : null;
  },

  extractEducationRequirement(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const triggers = ['formacao', 'graduacao', 'ensino superior', 'superior completo',
                      'superior cursando', 'bacharelado', 'tecnologo', 'licenciatura',
                      'pos-graduacao', 'mestrado', 'doutorado'];
    const hits = lines.filter((l) => {
      const n = utils.normalize(l);
      return triggers.some((t) => n.includes(utils.normalize(t)));
    });
    return hits.length > 0 ? hits.join(' ') : null;
  },

  isBehavioral(line) {
    const n = utils.normalize(line);
    return this.behavioralDict.some((b) => n.includes(utils.normalize(b)));
  },

  extractTools(text) {
    const n = utils.normalize(text);
    const found = new Set();
    for (const tool of this.toolsDict) {
      if (n.includes(utils.normalize(tool))) found.add(tool);
    }
    return [...found];
  },

  extractResponsibilities(lines) {
    const out = [];
    for (const raw of lines) {
      const line = raw.replace(/^[-*•]\s*/, '').trim();
      if (!line) continue;
      const firstWord = utils.normalize(line.split(/\s+/)[0] || '');
      if (this.responsibilityVerbs.some((v) => firstWord === v || firstWord.startsWith(v))) {
        out.push(line);
      }
    }
    return out;
  },

  extractRequirements(lines) {
    const requirements = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const isBullet = /^[-*•]/.test(line);
      const clean = line.replace(/^[-*•]\s*/, '').trim();
      if (clean.length < 3) continue;

      const n = utils.normalize(clean);
      const isDesired = this.desiredTriggers.some((t) => n.includes(utils.normalize(t)));
      const isRequired = this.requiredTriggers.some((t) => n.includes(utils.normalize(t)));

      const looksLikeReq =
        isBullet || isDesired || isRequired ||
        /(conhecimento|experiencia|dominio|habilidade|capacidade|formacao|ingles)/.test(n);

      if (!looksLikeReq) continue;

      let importance = 'obrigatorio';
      if (isDesired) importance = 'desejavel';
      else if (!isRequired && isBullet) importance = 'inferido';

      requirements.push({
        text: clean,
        importance,
        type: this.isBehavioral(clean) ? 'comportamental' : 'tecnico',
        tools: this.extractTools(clean)
      });
    }
    return requirements;
  },

  extractContextualKeywords(text, requirements) {
    const tokens = utils.tokenize(text).filter((t) => t.length >= 4);
    const freq = new Map();
    tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const titleLine = lines[0] || '';
    const titleTokens = new Set(utils.tokenize(titleLine));

    const highlighted = new Set();
    titleTokens.forEach((t) => highlighted.add(t));

    for (const req of requirements) {
      utils.tokenize(req.text).forEach((t) => {
        if (t.length >= 4) highlighted.add(t);
      });
    }

    return [...highlighted].sort((a, b) => {
      const fa = freq.get(a) || 0;
      const fb = freq.get(b) || 0;
      if (fb !== fa) return fb - fa;
      return a.localeCompare(b);
    });
  },

  parse(jobText) {
    const text = String(jobText || '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const requirements = this.extractRequirements(lines);
    const responsibilities = this.extractResponsibilities(lines);
    const tools = this.extractTools(text);
    const experienceYears = this.extractExperienceYears(text);
    const educationRequirement = this.extractEducationRequirement(text);
    const contextualKeywords = this.extractContextualKeywords(text, requirements);

    const obrigatorios = requirements.filter((r) => r.importance === 'obrigatorio');
    const desejaveis = requirements.filter((r) => r.importance === 'desejavel');
    const tecnicos = requirements.filter((r) => r.type === 'tecnico');
    const comportamentais = requirements.filter((r) => r.type === 'comportamental');

    const gaps = [];
    if (requirements.length === 0) gaps.push('Nenhum requisito identificado no texto da vaga.');
    if (obrigatorios.length === 0) gaps.push('Nenhum requisito obrigatório explícito — parte dos requisitos foi inferida.');
    if (responsibilities.length === 0) gaps.push('Nenhuma responsabilidade identificada (verbos no infinitivo).');
    if (tools.length === 0) gaps.push('Nenhuma ferramenta/tecnologia reconhecida no texto.');
    if (!educationRequirement) gaps.push('Formação exigida não mencionada na vaga.');

    return {
      requirements, obrigatorios, desejaveis, tecnicos, comportamentais,
      responsibilities, tools, experienceYears, educationRequirement,
      contextualKeywords, gaps, raw: text
    };
  }
};

/* ============================================================
   6. MATCHER — correspondência requisito × perfil
   ============================================================ */
const matcher = {
  synonyms: {
    'power bi': ['power bi', 'powerbi', 'power-bi', 'pbi', 'bi'],
    'excel': ['excel', 'microsoft excel', 'planilha', 'planilhas', 'excel avancado'],
    'sql': ['sql', 'mysql', 'postgresql', 'sql server', 'oracle', 'consultas sql'],
    'python': ['python', 'pandas', 'numpy', 'scikit-learn', 'pytorch', 'tensorflow'],
    'comunicacao': ['comunicacao', 'comunicativo', 'comunicar', 'apresentacao', 'apresentar'],
    'organizacao': ['organizacao', 'organizado', 'organizada', 'planejamento'],
    'proatividade': ['proatividade', 'proativo', 'proativa', 'iniciativa'],
    'trabalho em equipe': ['trabalho em equipe', 'equipe', 'colaboracao', 'colaborativo', 'colaborativa'],
    'lideranca': ['lideranca', 'lider', 'liderar', 'coordenacao', 'coordenar'],
    'ingles': ['ingles', 'english', 'intermediario', 'avancado', 'fluente'],
    'estatistica': ['estatistica', 'estatistico', 'analise estatistica', 'estatistica descritiva'],
    'dashboards': ['dashboard', 'dashboards', 'painel', 'paineis', 'relatorio', 'relatorios'],
    'indicadores': ['indicador', 'indicadores', 'kpi', 'kpis', 'metrica', 'metricas'],
    'analise de dados': ['analise de dados', 'analise', 'dados', 'analitico', 'analitica'],
    'insights': ['insight', 'insights', 'interpretacao', 'traduzir dados'],
    'git': ['git', 'github', 'gitlab'],
    'aws': ['aws', 'amazon web services'],
    'azure': ['azure', 'microsoft azure'],
    'gcp': ['gcp', 'google cloud'],
    'docker': ['docker', 'container', 'containers'],
    'javascript': ['javascript', 'js', 'typescript', 'node', 'react', 'vue', 'angular']
  },

  expandTokens(term) {
    const base = new Set(utils.tokenize(term).filter((t) => t.length >= 3));
    const normalized = utils.normalize(term);

    for (const [key, aliases] of Object.entries(this.synonyms)) {
      const hitKey = normalized.includes(utils.normalize(key));
      const hitAlias = aliases.some((a) => normalized.includes(utils.normalize(a)));
      if (hitKey || hitAlias) {
        base.add(utils.normalize(key));
        aliases.forEach((a) => utils.tokenize(a).forEach((t) => base.add(t)));
      }
    }
    return [...base];
  },

  termInText(term, text) {
    const normalizedText = utils.normalize(text);
    const tokens = this.expandTokens(term);
    let matched = null;

    for (const t of tokens) {
      if (t && normalizedText.includes(t)) {
        matched = t;
        if (normalizedText.includes(utils.normalize(term))) {
          matched = utils.normalize(term);
          break;
        }
      }
    }
    return { hit: !!matched, matchedTerm: matched };
  },

  findEvidence(requirementText, profileData) {
    const evidences = [];
    const reqText = requirementText;

    const tryField = (field, items, getText) => {
      items.forEach((item, index) => {
        const text = getText(item);
        if (!text) return;
        const { hit, matchedTerm } = this.termInText(reqText, text);
        if (hit) {
          evidences.push({
            field, index,
            snippet: this.snippet(text, matchedTerm),
            matchedTerm
          });
        }
      });
    };

    tryField('experiencia', profileData.experiences, (e) =>
      [e.title, e.company, ...(e.bullets || [])].filter(Boolean).join(' | ')
    );
    tryField('skill', profileData.skills, (s) => s);
    tryField('formacao', profileData.education, (e) => e);
    tryField('projeto', profileData.projects, (p) =>
      [p.title, ...(p.bullets || [])].filter(Boolean).join(' | ')
    );
    tryField('idioma', profileData.languages, (l) =>
      [l.language, l.level].filter(Boolean).join(' ')
    );
    tryField('certificacao', profileData.certifications, (c) => c);

    if (profileData.summary) {
      const { hit, matchedTerm } = this.termInText(reqText, profileData.summary);
      if (hit) {
        evidences.push({
          field: 'resumo', index: 0,
          snippet: this.snippet(profileData.summary, matchedTerm),
          matchedTerm
        });
      }
    }

    return evidences;
  },

  snippet(text, term, size = 80) {
    const t = String(text || '');
    if (!term) return t.slice(0, size);
    const idx = utils.normalize(t).indexOf(utils.normalize(term));
    if (idx < 0) return t.slice(0, size);
    const start = Math.max(0, idx - 30);
    const end = Math.min(t.length, idx + term.length + 40);
    return (start > 0 ? '…' : '') + t.slice(start, end).trim() + (end < t.length ? '…' : '');
  },

  scoreMatch(requirementText, profileData) {
    const evidences = this.findEvidence(requirementText, profileData);

    if (evidences.length === 0) {
      return { score: 0, evidences, coverage: 0 };
    }

    const reqTokens = utils.tokenize(requirementText).filter((t) => t.length >= 4);
    const expanded = new Set(reqTokens);
    const normalizedProfile = utils.normalize(JSON.stringify(profileData));
    let covered = 0;
    expanded.forEach((t) => { if (normalizedProfile.includes(t)) covered++; });
    const coverage = expanded.size > 0 ? covered / expanded.size : 0;

    const fieldWeight = {
      experiencia: 1.0, skill: 0.85, projeto: 0.8,
      formacao: 0.7, certificacao: 0.7, idioma: 0.6, resumo: 0.5
    };

    const bestFieldWeight = evidences.reduce(
      (max, e) => Math.max(max, fieldWeight[e.field] || 0.5), 0
    );

    const multiBonus = Math.min(0.1, (evidences.length - 1) * 0.05);

    const score = utils.clamp(
      coverage * 0.5 + bestFieldWeight * 0.4 + multiBonus, 0, 1
    );

    return { score, evidences, coverage };
  },

  classify(requirementText, profileData) {
    const { score, evidences, coverage } = this.scoreMatch(requirementText, profileData);

    if (score >= 0.75) return { status: 'A', label: 'Comprovado', score, evidences, coverage };
    if (score >= 0.35) return { status: 'B', label: 'Parcialmente demonstrado', score, evidences, coverage };

    const anyTokenHit = utils
      .tokenize(requirementText)
      .filter((t) => t.length >= 4)
      .some((t) => utils.normalize(JSON.stringify(profileData)).includes(t));

    return {
      status: 'C',
      label: anyTokenHit ? 'Não informado' : 'Não demonstrado',
      subtype: anyTokenHit ? 'nao_informado' : 'nao_demonstrado',
      score, evidences, coverage
    };
  },

  match(profileData, jobData) {
    const requirements = jobData.requirements || [];

    const results = requirements.map((req) => {
      const cls = this.classify(req.text, profileData);
      return {
        text: req.text,
        importance: req.importance,
        type: req.type,
        tools: req.tools || [],
        status: cls.status,
        statusLabel: cls.label,
        subtype: cls.subtype || null,
        score: cls.score,
        coverage: cls.coverage,
        evidences: cls.evidences
      };
    });

    const count = { A: 0, B: 0, C: 0 };
    const countByImportance = {
      obrigatorio: { A: 0, B: 0, C: 0 },
      desejavel: { A: 0, B: 0, C: 0 },
      inferido: { A: 0, B: 0, C: 0 }
    };
    const countByType = {
      tecnico: { A: 0, B: 0, C: 0 },
      comportamental: { A: 0, B: 0, C: 0 }
    };

    results.forEach((r) => {
      count[r.status]++;
      if (countByImportance[r.importance]) countByImportance[r.importance][r.status]++;
      if (countByType[r.type]) countByType[r.type][r.status]++;
    });

    const sections = this.deriveSections(profileData);
    const keywords = this.deriveKeywords(results, jobData);

    return {
      perfil: profileData,
      vaga: jobData,
      matches: results,
      count, countByImportance, countByType,
      sections, keywords,
      requirements: results.map((r) => ({
        text: r.text,
        status:
          r.status === 'A' ? 'demonstrado'
          : r.status === 'B' ? 'parcial'
          : 'nao_identificado'
      }))
    };
  },

  deriveSections(profileData) {
    return {
      contato: !!(profileData.contact && (profileData.contact.email || profileData.contact.phone)),
      resumo: !!profileData.summary,
      formacao: profileData.education && profileData.education.length > 0,
      experiencia: profileData.experiences && profileData.experiences.length > 0,
      competencias: profileData.skills && profileData.skills.length > 0,
      idiomas: profileData.languages && profileData.languages.length > 0,
      certificacoes: profileData.certifications && profileData.certifications.length > 0,
      projetos: profileData.projects && profileData.projects.length > 0
    };
  },

  deriveKeywords(matchResults, jobData) {
    const found = new Set();
    const missing = new Set();

    matchResults.forEach((r) => {
      const short = r.text.length > 40 ? r.text.slice(0, 40).trim() + '…' : r.text;
      if (r.status === 'A' || r.status === 'B') found.add(short);
      else missing.add(short);
    });

    (jobData.contextualKeywords || []).forEach((kw) => {
      const anyHit = matchResults.some((r) => (r.evidences || []).some((e) =>
        utils.normalize(e.snippet || '').includes(utils.normalize(kw))
      ));
      if (anyHit) found.add(kw);
      else missing.add(kw);
    });

    return {
      found: [...found].sort(),
      missing: [...missing].sort(),
      total: found.size + missing.size
    };
  }
};

/* ============================================================
   7. QUESTIONS — perguntas objetivas para lacunas de informação
   ============================================================ */
const questions = {
  catalog: {
    contatoEmail: {
      id: 'contato-email',
      question: 'Qual é o seu e-mail profissional para contato?',
      hint: 'Será exibido no topo do currículo gerado.'
    },
    contatoTelefone: {
      id: 'contato-telefone',
      question: 'Qual telefone (com DDD) você quer disponibilizar no currículo?',
      hint: 'Opcional se preferir só e-mail.'
    },
    contatoLinkedin: {
      id: 'contato-linkedin',
      question: 'Você tem um perfil de LinkedIn para incluir?',
      hint: 'Se sim, informe o link completo (linkedin.com/in/...).'
    },
    experienciaPeriodo: {
      id: 'experiencia-periodo',
      question: 'Alguma de suas experiências não tem período informado. Quer completar?',
      hint: 'Formato sugerido: "Mês/Ano – Mês/Ano" ou "Mês/Ano – Atual".'
    },
    experienciaAtividades: {
      id: 'experiencia-atividades',
      question: 'Alguma experiência está sem atividades descritas. Pode listar o que você fazia?',
      hint: 'Descreva ações reais. Não invente resultados.'
    },
    resultadosMensuraveis: {
      id: 'resultados',
      question: 'Em alguma experiência você obteve um resultado mensurável (%, número, prazo, volume)?',
      hint: 'Só informe se for verdade. Ex.: "reduzi o tempo de X em 20%".'
    },
    resumo: {
      id: 'resumo',
      question: 'Quer descrever em 2–3 linhas o seu perfil profissional atual?',
      hint: 'Usaremos como base do resumo direcionado à vaga.'
    },
    formacao: {
      id: 'formacao',
      question: 'Qual é a sua formação acadêmica (curso, instituição, ano de conclusão)?',
      hint: 'Mesmo que esteja cursando, informe.'
    },
    competencias: {
      id: 'competencias',
      question: 'Quais competências técnicas você domina e quer destacar?',
      hint: 'Separe por vírgulas. Ex.: Excel avançado, SQL, Power BI.'
    },
    idiomas: {
      id: 'idiomas',
      question: 'Quais idiomas você fala e em que nível?',
      hint: 'Ex.: Português (nativo), Inglês (intermediário).'
    },
    ferramenta: {
      id: 'ferramenta',
      template: (tool) => `Você tem experiência com ${tool}? Se sim, em que contexto?`,
      hint: 'Só responda se for verdade. Caso contrário, ignore.'
    },
    requisitoNaoInformado: {
      id: 'req-nao-informado',
      template: (req) => `A vaga pede "${req}". Você tem essa experiência ou competência?`,
      hint: 'Se sim, descreva brevemente onde usou. Se não, ignore.'
    }
  },

  build(profileData, matchData) {
    const out = [];

    if (!profileData.contact.email) out.push(this.catalog.contatoEmail);
    if (!profileData.contact.phone) out.push(this.catalog.contatoTelefone);
    if (!profileData.contact.linkedin) out.push(this.catalog.contatoLinkedin);

    const semPeriodo = profileData.experiences.some((e) => !e.period);
    const semAtividades = profileData.experiences.some((e) => e.bullets.length === 0);
    if (semPeriodo) out.push(this.catalog.experienciaPeriodo);
    if (semAtividades) out.push(this.catalog.experienciaAtividades);

    const temNumeros = profileData.experiences.some((e) =>
      e.bullets.some((b) => /\d+%|\d+\s*(mil|milh|k|reais|r\$)|aument|reduz|otimiz|economiz/i.test(b))
    );
    if (profileData.experiences.length > 0 && !temNumeros) {
      out.push(this.catalog.resultadosMensuraveis);
    }

    if (!profileData.summary) out.push(this.catalog.resumo);
    if (profileData.education.length === 0) out.push(this.catalog.formacao);
    if (profileData.skills.length === 0) out.push(this.catalog.competencias);
    if (profileData.languages.length === 0) out.push(this.catalog.idiomas);

    const naoInformados = (matchData.matches || [])
      .filter((m) => m.status === 'C' && m.subtype === 'nao_informado')
      .slice(0, 3);
    naoInformados.forEach((m) => {
      out.push({
        id: 'req-' + utils.normalize(m.text).slice(0, 30),
        question: this.catalog.requisitoNaoInformado.template(m.text),
        hint: this.catalog.requisitoNaoInformado.hint
      });
    });

    const toolsAusentes = (matchData.vaga.tools || []).filter((tool) => {
      return !(matchData.matches || []).some(
        (m) => (m.status === 'A' || m.status === 'B') &&
               m.tools && m.tools.includes(tool)
      );
    }).slice(0, 2);
    toolsAusentes.forEach((tool) => {
      out.push({
        id: 'tool-' + utils.normalize(tool),
        question: this.catalog.ferramenta.template(tool),
        hint: this.catalog.ferramenta.hint
      });
    });

    return out.slice(0, 8);
  }
};

/* ============================================================
   8. SCORER — pontuação 0–100 com critérios transparentes
   ------------------------------------------------------------
   A nota mede ADERÊNCIA ESTIMADA ao conteúdo da vaga.
   Não é previsão de contratação nem nota real de ATS.

   Critérios e pesos (100 pts possíveis + penalidade de -5):
   - 10 pts: Dados de contato
   - 10 pts: Seções principais identificadas
   - 25 pts: Cobertura dos requisitos OBRIGATÓRIOS
   - 10 pts: Cobertura dos requisitos DESEJÁVEIS
   - 25 pts: Evidência em experiências/projetos
   - 20 pts: Clareza e organização
   ============================================================ */
const scorer = {
  compute(analysis, resumeText) {
    const breakdown = [];
    let total = 0;

    const contactPoints =
      (utils.hasEmail(resumeText) ? 4 : 0) +
      (utils.hasPhone(resumeText) ? 3 : 0) +
      (utils.hasLinkedin(resumeText) ? 3 : 0);
    total += contactPoints;
    breakdown.push({
      label: 'Dados de contato (e-mail, telefone, LinkedIn)',
      points: contactPoints, max: 10
    });

    const sectionKeys = ['resumo', 'formacao', 'experiencia', 'competencias'];
    const sectionsFound = sectionKeys.filter((k) => analysis.sections[k]).length;
    const sectionPoints = Math.round((sectionsFound / sectionKeys.length) * 10);
    total += sectionPoints;
    breakdown.push({
      label: 'Seções principais identificadas',
      points: sectionPoints, max: 10
    });

    const obrig = analysis.countByImportance.obrigatorio;
    const obrigTotal = obrig.A + obrig.B + obrig.C;
    let obrigPoints = 0;
    if (obrigTotal > 0) {
      const ratio = (obrig.A + obrig.B * 0.5) / obrigTotal;
      obrigPoints = Math.round(ratio * 25);
    }
    total += obrigPoints;
    breakdown.push({
      label: 'Cobertura dos requisitos obrigatórios',
      points: obrigPoints, max: 25
    });

    const desej = analysis.countByImportance.desejavel;
    const desejTotal = desej.A + desej.B + desej.C;
    let desejPoints = 0;
    if (desejTotal > 0) {
      const ratio = (desej.A + desej.B * 0.5) / desejTotal;
      desejPoints = Math.round(ratio * 10);
    }
    total += desejPoints;
    breakdown.push({
      label: 'Cobertura dos requisitos desejáveis',
      points: desejPoints, max: 10
    });

    let evidencePoints = 0;
    if (analysis.matches.length > 0) {
      const withEvidence = analysis.matches.filter((m) =>
        m.evidences.some((e) => e.field === 'experiencia' || e.field === 'projeto')
      ).length;
      const ratio = withEvidence / analysis.matches.length;
      evidencePoints = Math.round(ratio * 25);
    }
    total += evidencePoints;
    breakdown.push({
      label: 'Evidência em experiências/projetos',
      points: evidencePoints, max: 25
    });

    const profileData = analysis.perfil;
    let qualityPoints = 0;
    if (profileData.summary) qualityPoints += 5;
    if (profileData.experiences.length > 0) {
      const withBullets = profileData.experiences.filter((e) => e.bullets.length > 0).length;
      const withPeriod = profileData.experiences.filter((e) => e.period).length;
      qualityPoints += Math.round((withBullets / profileData.experiences.length) * 5);
      qualityPoints += Math.round((withPeriod / profileData.experiences.length) * 5);
    }
    if (profileData.skills.length > 0) qualityPoints += 5;
    qualityPoints = utils.clamp(qualityPoints, 0, 20);
    total += qualityPoints;
    breakdown.push({
      label: 'Clareza e organização do documento',
      points: qualityPoints, max: 20
    });

    const words = utils.tokenize(resumeText).length;
    if (words < 40) {
      total -= 5;
      breakdown.push({
        label: 'Currículo muito curto (penalidade)',
        points: -5, max: 0
      });
    }

    const score = utils.clamp(Math.round(total), 0, 100);
    return { score, breakdown };
  },

  label(score) {
    if (score >= 85) return 'Excelente aderência estimada à vaga';
    if (score >= 70) return 'Boa aderência estimada à vaga';
    if (score >= 50) return 'Aderência moderada — há espaço para melhorias';
    if (score >= 30) return 'Aderência baixa — revise e ajuste o currículo';
    return 'Aderência muito baixa — reformule o currículo para esta vaga';
  }
};

/* ============================================================
   9. REPORT — problemas, sugestões e evidências
   ============================================================ */
const report = {
  build(analysis, resumeText, scoreInfo) {
    const problems = [];
    const suggestions = [];
    const positives = [];
    const profileData = analysis.perfil;

    if (profileData.contact.email) positives.push('E-mail identificado no currículo.');
    if (profileData.contact.phone) positives.push('Telefone identificado no currículo.');
    if (profileData.contact.linkedin) positives.push('LinkedIn identificado no currículo.');

    const sectionLabels = {
      resumo: 'Resumo profissional',
      formacao: 'Formação acadêmica',
      experiencia: 'Experiência profissional',
      competencias: 'Competências',
      idiomas: 'Idiomas',
      certificacoes: 'Certificações/Cursos',
      projetos: 'Projetos'
    };
    for (const [k, label] of Object.entries(sectionLabels)) {
      if (analysis.sections[k]) positives.push(`Seção "${label}" identificada.`);
    }

    if (!profileData.contact.email) {
      problems.push('Não foi identificado e-mail no currículo.');
      suggestions.push('Inclua um e-mail profissional no topo do currículo.');
    }
    if (!profileData.contact.phone) {
      problems.push('Não foi identificado telefone no currículo.');
      suggestions.push('Adicione um telefone com DDD para contato.');
    }
    if (!profileData.contact.linkedin) {
      problems.push('LinkedIn não identificado.');
      suggestions.push('Adicione o link do seu LinkedIn (se tiver um perfil atualizado).');
    }

    for (const [k, label] of Object.entries(sectionLabels)) {
      if (!analysis.sections[k]) {
        problems.push(`Seção "${label}" não identificada.`);
        if (k === 'resumo') suggestions.push('Adicione um resumo profissional curto (3–5 linhas) destacando seu perfil.');
        else if (k === 'formacao') suggestions.push('Inclua sua formação acadêmica com curso, instituição e período.');
        else if (k === 'experiencia') suggestions.push('Descreva suas experiências com cargo, empresa, período e atividades.');
        else if (k === 'competencias') suggestions.push('Liste competências técnicas e comportamentais relevantes para a vaga.');
        else if (k === 'idiomas') suggestions.push('Inclua idiomas e nível de proficiência, se forem relevantes.');
        else if (k === 'certificacoes') suggestions.push('Inclua certificações e cursos concluídos, se forem relevantes.');
        else if (k === 'projetos') suggestions.push('Se você tem projetos pessoais relevantes, inclua uma seção "Projetos".');
      }
    }

    const matches = analysis.matches || [];

    const obrigatoriosC = matches.filter((m) => m.importance === 'obrigatorio' && m.status === 'C');
    if (obrigatoriosC.length > 0) {
      const list = obrigatoriosC.map((m) => m.text).slice(0, 5);
      problems.push(
        `${obrigatoriosC.length} requisito(s) OBRIGATÓRIO(S) não atendido(s) ou não informado(s): ` +
          list.join('; ') + (obrigatoriosC.length > 5 ? '…' : '.')
      );
      suggestions.push(
        'Para cada requisito obrigatório não atendido: se você realmente tem essa ' +
          'experiência, descreva-a com um exemplo concreto. Caso contrário, considere ' +
          'se este perfil é o mais adequado para esta vaga.'
      );
    }

    const desejaveisC = matches.filter((m) => m.importance === 'desejavel' && m.status === 'C');
    if (desejaveisC.length > 0) {
      problems.push(`${desejaveisC.length} requisito(s) desejável(is) não identificado(s) no currículo.`);
    }

    const tecnicosC = matches.filter((m) => m.type === 'tecnico' && m.status === 'C');
    if (tecnicosC.length > 0) {
      const top = tecnicosC.map((m) => m.text).slice(0, 8);
      suggestions.push(
        'Competências técnicas ausentes no texto (verifique se você realmente as possui): ' +
          top.join(', ') + (tecnicosC.length > 8 ? '…' : '.')
      );
    }

    const comportamentaisC = matches.filter((m) => m.type === 'comportamental' && m.status === 'C');
    if (comportamentaisC.length > 0) {
      suggestions.push(
        'Competências comportamentais da vaga que não foram identificadas no texto: ' +
          comportamentaisC.map((m) => m.text).join('; ') + '.'
      );
    }

    const words = utils.tokenize(resumeText).length;
    if (words < 40) {
      problems.push('O currículo parece muito curto.');
      suggestions.push('Detalhe melhor suas experiências e competências para dar contexto ao recrutador.');
    }

    if (profileData.experiences.length > 0) {
      const semPeriodo = profileData.experiences.filter((e) => !e.period).length;
      if (semPeriodo > 0) {
        problems.push(`${semPeriodo} experiência(s) sem período informado.`);
        suggestions.push('Informe o período de cada experiência no formato "Mês/Ano – Mês/Ano".');
      }

      const semBullets = profileData.experiences.filter((e) => e.bullets.length === 0).length;
      if (semBullets > 0) {
        problems.push(`${semBullets} experiência(s) sem atividades descritas.`);
        suggestions.push('Liste as atividades de cada experiência em tópicos objetivos.');
      }

      const temNumeros = profileData.experiences.some((e) =>
        e.bullets.some((b) => /\d+%|\d+\s*(mil|milh|k|reais|r\$)|aument|reduz|otimiz|economiz/i.test(b))
      );
      if (!temNumeros) {
        problems.push('Nenhum resultado mensurável foi identificado nas experiências.');
        suggestions.push(
          'Se você obteve resultados concretos (%, prazos, volumes, economia), ' +
            'descreva-os. Só inclua se forem verdadeiros.'
        );
      }
    }

    if (scoreInfo.score < 50) {
      suggestions.push(
        'Reescreva o resumo e as experiências usando termos da vaga que você ' +
          'realmente domina, para deixar clara a aderência.'
      );
    }

    let html = '';

    if (positives.length > 0) {
      html += `
        <div class="report-section ok">
          <h4>Pontos positivos identificados</h4>
          <ul>${positives.map((p) => `<li>${utils.escapeHtml(p)}</li>`).join('')}</ul>
        </div>
      `;
    }

    if (problems.length > 0) {
      html += `
        <div class="report-section danger">
          <h4>Problemas e lacunas encontrados</h4>
          <ul>${problems.map((p) => `<li>${utils.escapeHtml(p)}</li>`).join('')}</ul>
        </div>
      `;
    }

    if (suggestions.length > 0) {
      html += `
        <div class="report-section warn">
          <h4>Sugestões de melhoria (sem inventar dados)</h4>
          <ul>${suggestions.map((s) => `<li>${utils.escapeHtml(s)}</li>`).join('')}</ul>
        </div>
      `;
    }

    html += `
      <div class="report-section">
        <h4>Lembrete importante</h4>
        <ul>
          <li>A pontuação é uma <strong>estimativa própria</strong> do OR System, baseada em critérios visíveis no texto.</li>
          <li>Ela <strong>não</strong> reproduz algoritmos internos de empresas ou de sistemas ATS.</li>
          <li>A ausência de uma palavra não significa ausência da sua competência.</li>
          <li>Não inclua informações falsas: as sugestões servem para <em>apresentar melhor</em> o que é verdadeiro.</li>
        </ul>
      </div>
    `;

    return html;
  }
};

/* ============================================================
   10. RESUME BUILDER — geração de currículo direcionado
   ------------------------------------------------------------
   Estratégia:
   - Reordena experiências e bullets por relevância à vaga.
   - Gera resumo direcionado, baseado em fatos do próprio perfil.
   - Reescreve bullets no formato “ação + ferramenta + contexto”
     quando há dados suficientes (sem inventar resultados).
   - Mantém seções em formato simples de uma coluna (ATS-friendly).
   ------------------------------------------------------------
   NÃO inventa: campos ausentes ficam ausentes ou viram pergunta.
   ============================================================ */
const resumeBuilder = {
  relevanceScore(text, matches) {
    const tokens = utils.tokenize(text).filter((t) => t.length >= 4);
    if (tokens.length === 0) return 0;

    const reqTokens = new Set();
    matches.forEach((m) => {
      utils.tokenize(m.text).forEach((t) => reqTokens.add(t));
    });
    if (reqTokens.size === 0) return 0;

    const hits = tokens.filter((t) => reqTokens.has(t)).length;
    return hits / tokens.length;
  },

  /**
   * Reescreve um bullet mantendo a verdade, apenas melhorando clareza.
   * Regra:
   * - Se o bullet já começa com verbo de ação (lista interna), mantém.
   * - Se não começa, e é uma frase curta, capitaliza o primeiro termo.
   * - NÃO cria contexto, ferramenta, número ou resultado que não exista.
   */
  polishBullet(bullet) {
    let b = String(bullet || '').trim();
    if (!b) return b;

    b = b.replace(/^[-–—•*]\s*/, '').trim();
    b = b.charAt(0).toUpperCase() + b.slice(1);
    if (!/[.!?]$/.test(b)) b += '.';
    return b;
  },

  reorderBullets(exp, matches) {
    if (!exp.bullets || exp.bullets.length === 0) return exp;
    const ordered = [...exp.bullets]
      .map((b) => this.polishBullet(b))
      .sort((a, b) => this.relevanceScore(b, matches) - this.relevanceScore(a, matches));
    return { ...exp, bullets: ordered };
  },

  reorderExperiences(experiences, matches) {
    if (!experiences || experiences.length === 0) return [];
    return experiences
      .map((e) => this.reorderBullets(e, matches))
      .sort((a, b) => {
        const sa = this.relevanceScore(
          [a.title, a.company, ...(a.bullets || [])].filter(Boolean).join(' '), matches
        );
        const sb = this.relevanceScore(
          [b.title, b.company, ...(b.bullets || [])].filter(Boolean).join(' '), matches
        );
        return sb - sa;
      });
  },

  reorderSkills(skills, matches) {
    if (!skills || skills.length === 0) return [];
    return [...skills].sort((a, b) =>
      this.relevanceScore(b, matches) - this.relevanceScore(a, matches)
    );
  },

  buildSummary(profileData, matchData) {
    const parts = [];

    const latest = profileData.experiences[0] || null;
    const cargo = latest && latest.title ? latest.title : 'Profissional';
    const anos = profileData.experiences.length;

    if (profileData.summary) {
      parts.push(profileData.summary.trim().replace(/\.$/, '') + '.');
    } else {
      const experienciaTxt = anos > 0
        ? `Com ${anos} experiência${anos > 1 ? 's' : ''} profissional${anos > 1 ? 'is' : ''}`
        : 'Profissional';
      parts.push(`${experienciaTxt}, atuando como ${cargo}.`);
    }

    const skillsRelevantes = this.reorderSkills(profileData.skills, matchData.matches)
      .filter((s) => this.relevanceScore(s, matchData.matches) > 0)
      .slice(0, 5);

    if (skillsRelevantes.length > 0) {
      parts.push(`Competências alinhadas à vaga: ${skillsRelevantes.join(', ')}.`);
    }

    const comprovados = matchData.matches
      .filter((m) => m.status === 'A' && m.importance === 'obrigatorio')
      .slice(0, 3)
      .map((m) => m.text.toLowerCase());

    if (comprovados.length > 0) {
      parts.push('Experiência comprovada em requisitos-chave como ' + comprovados.join(', ') + '.');
    }

    return parts.join(' ').trim();
  },

  build(profileData, matchData) {
    const out = [];

    if (profileData.contact.name) out.push(profileData.contact.name);

    const contactLine = [
      profileData.contact.location,
      profileData.contact.phone,
      profileData.contact.email,
      profileData.contact.linkedin
    ].filter(Boolean).join(' | ');
    if (contactLine) out.push(contactLine);

    out.push('');

    const summary = this.buildSummary(profileData, matchData);
    if (summary) {
      out.push('RESUMO PROFISSIONAL');
      out.push(summary);
      out.push('');
    }

    const skills = this.reorderSkills(profileData.skills, matchData.matches);
    if (skills.length > 0) {
      out.push('COMPETÊNCIAS');
      out.push(skills.join(', '));
      out.push('');
    }

    const experiences = this.reorderExperiences(profileData.experiences, matchData.matches);
    if (experiences.length > 0) {
      out.push('EXPERIÊNCIA PROFISSIONAL');
      for (const exp of experiences) {
        const titleParts = [exp.title, exp.company].filter(Boolean);
        if (titleParts.length > 0) out.push(titleParts.join(' — '));
        if (exp.period) out.push(exp.period);
        for (const b of exp.bullets) out.push(`- ${b}`);
        out.push('');
      }
    }

    if (profileData.projects.length > 0) {
      out.push('PROJETOS');
      for (const p of profileData.projects) {
        if (p.title) out.push(p.title);
        for (const b of p.bullets) out.push(`- ${this.polishBullet(b)}`);
        out.push('');
      }
    }

    if (profileData.education.length > 0) {
      out.push('FORMAÇÃO');
      for (const e of profileData.education) out.push(e);
      out.push('');
    }

    if (profileData.certifications.length > 0) {
      out.push('CERTIFICAÇÕES E CURSOS');
      for (const c of profileData.certifications) out.push(c);
      out.push('');
    }

    if (profileData.languages.length > 0) {
      out.push('IDIOMAS');
      for (const l of profileData.languages) {
        out.push(l.level ? `${l.language} — ${l.level}` : l.language);
      }
      out.push('');
    }

    while (out.length > 0 && out[out.length - 1] === '') out.pop();

    return out.join('\n');
  }
};

/* ============================================================
   11. PREVIEW — renderiza o currículo final em HTML estruturado
   ============================================================ */
const preview = {
  render(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = [];

    let inList = false;
    const closeList = () => {
      if (inList) { out.push('</ul>'); inList = false; }
    };

    const isHeaderLine = (line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.length > 60) return false;
      const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
      if (letters.length < 3) return false;
      return letters === letters.toUpperCase();
    };

    let firstNonEmpty = true;

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const trimmed = line.trim();

      if (!trimmed) { closeList(); continue; }

      if (/^[-*•]\s+/.test(trimmed)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        const item = trimmed.replace(/^[-*•]\s+/, '');
        out.push(`<li>${utils.escapeHtml(item)}</li>`);
        continue;
      }

      closeList();

      if (firstNonEmpty) {
        firstNonEmpty = false;
        out.push(`<h1>${utils.escapeHtml(trimmed)}</h1>`);
        continue;
      }

      if (isHeaderLine(trimmed)) {
        out.push(`<h2>${utils.escapeHtml(trimmed)}</h2>`);
        continue;
      }

      if (utils.hasEmail(trimmed) || utils.hasPhone(trimmed) || /linkedin\.com/i.test(trimmed)) {
        out.push(`<p class="preview-contact">${utils.escapeHtml(trimmed)}</p>`);
        continue;
      }

      out.push(`<p>${utils.escapeHtml(trimmed)}</p>`);
    }

    closeList();
    return out.join('\n');
  }
};

/* ============================================================
   12. UI — eventos, mensagens, contadores, orquestração
   ============================================================ */
const ui = {
  els: {},

  cacheElements() {
    this.els = {
      messages: document.getElementById('global-messages'),
      inputResume: document.getElementById('input-resume'),
      inputJob: document.getElementById('input-job'),
      resumeCounter: document.getElementById('resume-counter'),
      jobCounter: document.getElementById('job-counter'),
      btnAnalyze: document.getElementById('btn-analyze'),
      btnSample: document.getElementById('btn-sample'),
      btnClear: document.getElementById('btn-clear'),
      results: document.getElementById('results'),
      scoreNumber: document.getElementById('score-number'),
      scoreProgress: document.getElementById('score-progress'),
      scoreLabel: document.getElementById('score-label'),
      scoreDescription: document.getElementById('score-description'),
      scoreBreakdown: document.getElementById('score-breakdown'),
      keywordsFound: document.getElementById('keywords-found'),
      keywordsMissing: document.getElementById('keywords-missing'),
      requirementsList: document.getElementById('requirements-list'),
      reportContent: document.getElementById('report-content'),
      questionsList: document.getElementById('questions-list'),
      editor: document.getElementById('editor'),
      inputResumeEdited: document.getElementById('input-resume-edited'),
      btnPreview: document.getElementById('btn-preview'),
      btnResetEditor: document.getElementById('btn-reset-editor'),
      preview: document.getElementById('preview'),
      previewContent: document.getElementById('preview-content'),
      btnPrint: document.getElementById('btn-print'),
      btnBackEdit: document.getElementById('btn-back-edit'),
      year: document.getElementById('year')
    };
  },

  showMessage(type, text, timeout = 6000) {
    const el = this.els.messages;
    if (!el) return;

    const div = document.createElement('div');
    div.className = `message message-${type}`;
    div.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const span = document.createElement('span');
    span.textContent = text;
    div.appendChild(span);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'message-close';
    close.setAttribute('aria-label', 'Fechar mensagem');
    close.textContent = '×';
    close.addEventListener('click', () => div.remove());
    div.appendChild(close);

    el.appendChild(div);

    if (timeout > 0) setTimeout(() => { if (div.parentNode) div.remove(); }, timeout);
  },

  clearMessages() { if (this.els.messages) this.els.messages.innerHTML = ''; },

  updateCounter(textarea, target) {
    if (!textarea || !target) return;
    const len = textarea.value.length;
    target.textContent = `${len} caracter${len === 1 ? 'er' : 'es'}`;
  },

  validateInputs() {
    const resume = this.els.inputResume.value.trim();
    const job = this.els.inputJob.value.trim();
    let ok = true;

    if (!resume) { this.els.inputResume.classList.add('invalid'); ok = false; }
    else this.els.inputResume.classList.remove('invalid');

    if (!job) { this.els.inputJob.classList.add('invalid'); ok = false; }
    else this.els.inputJob.classList.remove('invalid');

    if (!ok) {
      this.showMessage('error', 'Preencha os campos obrigatórios: currículo e descrição da vaga.');
    }
    return ok;
  },

  updateScoreCircle(score) {
    const circle = this.els.scoreProgress;
    if (!circle) return;

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;

    let color = '#c53030';
    if (score >= 85) color = '#1f9d55';
    else if (score >= 70) color = '#1e6bff';
    else if (score >= 50) color = '#b7791f';

    circle.style.stroke = color;
  },

  renderKeywords(found, missing) {
    const foundEl = this.els.keywordsFound;
    const missingEl = this.els.keywordsMissing;

    if (found.length === 0) foundEl.innerHTML = '<li class="empty">Nenhuma palavra-chave encontrada.</li>';
    else foundEl.innerHTML = found.map((k) => `<li>${utils.escapeHtml(k)}</li>`).join('');

    if (missing.length === 0) missingEl.innerHTML = '<li class="empty">Todas as palavras-chave da vaga foram encontradas.</li>';
    else missingEl.innerHTML = missing.map((k) => `<li>${utils.escapeHtml(k)}</li>`).join('');
  },

  renderRequirements(matches) {
    const el = this.els.requirementsList;
    if (!matches || matches.length === 0) {
      el.innerHTML = '<li class="empty">Nenhum requisito identificado na descrição da vaga.</li>';
      return;
    }

    const clsMap = { A: 'demonstrado', B: 'parcial', C: 'ausente' };
    const labelMap = { A: 'Comprovado', B: 'Parcial', C: 'Não demonstrado' };

    el.innerHTML = matches.map((r) => {
      const cls = clsMap[r.status] || 'ausente';
      const label = labelMap[r.status] || r.status;
      const imp = r.importance === 'desejavel' ? ' (desejável)' : '';
      const src = r.evidences && r.evidences.length > 0
        ? `<small class="req-src">Origem: ${utils.escapeHtml(r.evidences[0].field)} — ${utils.escapeHtml(r.evidences[0].snippet)}</small>`
        : '';
      return `
        <li class="${cls}">
          <span class="badge">${label}</span>
          <span>${utils.escapeHtml(r.text)}${imp}${src}</span>
        </li>
      `;
    }).join('');
  },

  renderBreakdown(breakdown) {
    const el = this.els.scoreBreakdown;
    if (!el) return;

    el.innerHTML = breakdown.map((b) => {
      const sign = b.points > 0 ? '+' : '';
      const pts = b.max > 0 ? `${sign}${b.points}/${b.max}` : `${sign}${b.points}`;
      return `<li><span>${utils.escapeHtml(b.label)}</span><span class="pts">${pts}</span></li>`;
    }).join('');
  },

  renderQuestions(list) {
    const el = this.els.questionsList;
    if (!el) return;

    if (!list || list.length === 0) {
      el.innerHTML = '<li class="empty">Nenhuma pergunta no momento — seu perfil já cobre os pontos principais.</li>';
      return;
    }

    el.innerHTML = list.map((q) => `
      <li>
        <strong>${utils.escapeHtml(q.question)}</strong>
        ${q.hint ? `<span class="q-hint">${utils.escapeHtml(q.hint)}</span>` : ''}
      </li>
    `).join('');
  },

  showResults() {
    this.els.results.classList.remove('hidden');
    this.els.editor.classList.remove('hidden');
    this.els.preview.classList.add('hidden');
    this.els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  hideResults() {
    this.els.results.classList.add('hidden');
    this.els.editor.classList.add('hidden');
    this.els.preview.classList.add('hidden');
  },

  runAnalysis() {
    this.clearMessages();
    if (!this.validateInputs()) return;

    const resume = this.els.inputResume.value;
    const job = this.els.inputJob.value;

    state.resumeOriginal = resume;
    state.job = job;

    const profileData = profile.parse(resume);
    const jobData = jobSpec.parse(job);
    state.profileData = profileData;
    state.jobData = jobData;

    const analysis = matcher.match(profileData, jobData);
    state.analysis = analysis;

    const scoreInfo = scorer.compute(analysis, resume);
    state.scoreInfo = scoreInfo;

    const qs = questions.build(profileData, analysis);
    state.questions = qs;

    this.els.scoreNumber.textContent = String(scoreInfo.score);
    this.updateScoreCircle(scoreInfo.score);
    this.els.scoreLabel.textContent = scorer.label(scoreInfo.score);

    const obrig = analysis.countByImportance.obrigatorio;
    const desej = analysis.countByImportance.desejavel;
    this.els.scoreDescription.textContent =
      `Aderência estimada à vaga, baseada em critérios visíveis. ` +
      `Obrigatórios — comprovados: ${obrig.A}, parciais: ${obrig.B}, não atendidos: ${obrig.C}. ` +
      `Desejáveis — comprovados: ${desej.A}, parciais: ${desej.B}, não atendidos: ${desej.C}. ` +
      `Esta pontuação não reproduz algoritmos de ATS ou de empresas.`;

    this.renderBreakdown(scoreInfo.breakdown);
    this.renderKeywords(analysis.keywords.found, analysis.keywords.missing);
    this.renderRequirements(analysis.matches);
    this.els.reportContent.innerHTML = report.build(analysis, resume, scoreInfo);
    this.renderQuestions(qs);

    this.els.inputResumeEdited.value = resume;
    state.resumeEdited = resume;

    this.showResults();
    state.hasAnalyzed = true;

    this.showMessage('success', 'Análise concluída. Revise resultados, responda às perguntas e edite seu currículo.', 6000);
  },

  loadSample() {
    this.els.inputResume.value = samples.resume;
    this.els.inputJob.value = samples.job;
    this.updateCounter(this.els.inputResume, this.els.resumeCounter);
    this.updateCounter(this.els.inputJob, this.els.jobCounter);
    this.els.inputResume.classList.remove('invalid');
    this.els.inputJob.classList.remove('invalid');
    this.clearMessages();
    this.showMessage('info', 'Exemplo carregado. Clique em "Analisar compatibilidade".', 5000);
  },

  clearAll() {
    this.els.inputResume.value = '';
    this.els.inputJob.value = '';
    this.els.inputResumeEdited.value = '';
    this.updateCounter(this.els.inputResume, this.els.resumeCounter);
    this.updateCounter(this.els.inputJob, this.els.jobCounter);
    this.els.inputResume.classList.remove('invalid');
    this.els.inputJob.classList.remove('invalid');

    state.resumeOriginal = '';
    state.resumeEdited = '';
    state.job = '';
    state.profileData = null;
    state.jobData = null;
    state.analysis = null;
    state.scoreInfo = null;
    state.questions = [];
    state.hasAnalyzed = false;

    this.hideResults();
    this.clearMessages();
    this.showMessage('info', 'Campos limpos. Você pode começar uma nova análise.', 4000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  generatePreview() {
    const edited = this.els.inputResumeEdited.value.trim();
    const analysis = state.analysis;

    if (!analysis) {
      this.showMessage('warn', 'Faça uma análise primeiro para gerar o currículo direcionado.');
      return;
    }

    let toRender = edited;

    if (edited === state.resumeOriginal.trim()) {
      toRender = resumeBuilder.build(state.profileData, analysis);
      this.els.inputResumeEdited.value = toRender;
      state.resumeEdited = toRender;
    }

    if (!toRender) {
      this.showMessage('error', 'Não foi possível gerar o currículo. Verifique os dados de entrada.');
      return;
    }

    this.els.previewContent.innerHTML = preview.render(toRender);
    this.els.preview.classList.remove('hidden');
    this.els.preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.showMessage('success', 'Currículo direcionado gerado. Use o botão para imprimir ou salvar em PDF.', 5000);
  },

  resetEditor() {
    if (!state.resumeOriginal) {
      this.showMessage('warn', 'Nenhum texto original disponível. Faça uma análise primeiro.');
      return;
    }
    this.els.inputResumeEdited.value = state.resumeOriginal;
    state.resumeEdited = state.resumeOriginal;
    this.showMessage('info', 'Texto original restaurado no editor.', 4000);
  },

  printPreview() {
    if (this.els.preview.classList.contains('hidden')) {
      this.showMessage('warn', 'Gere a pré-visualização antes de imprimir.');
      return;
    }
    window.print();
  },

  bindEvents() {
    this.els.inputResume.addEventListener('input', () =>
      this.updateCounter(this.els.inputResume, this.els.resumeCounter)
    );
    this.els.inputJob.addEventListener('input', () =>
      this.updateCounter(this.els.inputJob, this.els.jobCounter)
    );

    this.els.btnAnalyze.addEventListener('click', () => this.runAnalysis());
    this.els.btnSample.addEventListener('click', () => this.loadSample());
    this.els.btnClear.addEventListener('click', () => this.clearAll());

    this.els.btnPreview.addEventListener('click', () => this.generatePreview());
    this.els.btnResetEditor.addEventListener('click', () => this.resetEditor());

    this.els.btnPrint.addEventListener('click', () => this.printPreview());
    this.els.btnBackEdit.addEventListener('click', () => {
      this.els.editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (this.els.year) this.els.year.textContent = String(new Date().getFullYear());

    document.addEventListener('keydown', (e) => {
      const isAnalyzeShortcut = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
      if (isAnalyzeShortcut) { e.preventDefault(); this.runAnalysis(); }
    });
  },

  init() {
    this.cacheElements();
    this.bindEvents();
    this.updateCounter(this.els.inputResume, this.els.resumeCounter);
    this.updateCounter(this.els.inputJob, this.els.jobCounter);
  }
};

/* ============================================================
   13. BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  ui.init();
});