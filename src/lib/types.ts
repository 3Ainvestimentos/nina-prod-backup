

// This is a type definition file.
export type Role = "Colaborador" | "Líder" | "Líder de Projeto" | "Diretor";

export type InteractionStatus = string;
// PDI is not a direct interaction type, it has its own table.
export type InteractionType = "1:1" | "Feedback" | "N3 Individual" | "Índice de Risco" | "N2 Individual" | "Índice de Qualidade" | "Análise do Índice de Qualidade" | "Análise do Índice de Risco";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: Role;
}

export interface Employee {
  id: string; 
  id3a: string;
  name: string;
  email: string;
  photoURL?: string;
  axis?: string;
  area?: string;
  position?: string;
  segment?: string;
  leaderId?: string;
  leader?: string;
  leaderEmail?: string;
  city?: string;
  role?: Role;
  team?: string;
  diagnosis?: Diagnosis;
  riskScore?: number;
  qualityScore?: number; // Pontuação do Índice de Qualidade para líderes
  isUnderManagement?: boolean;
  isDirector?: boolean;
  isAdmin?: boolean;
}

export interface OneOnOneNotes {
    companyGrowth?: string;
    leaderGrowth?: string;
    teamGrowth?: string;
    personalLife?: string;
    observations?: string;
}

export interface N3IndividualNotes {
    captacao?: string;
    churnPF?: string;
    roa?: string;
    esforcos?: string;
    planoAcao?: string;
}

export interface N2IndividualNotes {
    captacaoTIME: string;
    churnPFTIME: string;
    roaTIME: string;
    notaRanking: number; // readonly, preenchido automaticamente do ranking
    planoAcao: string;
    anotacoes: string;
}

export interface QualityIndexNotes {
    performanceTime: "red" | "neutral" | "green";
    relacionamentoTime: "red" | "neutral" | "green";
    remuneracao: "red" | "neutral" | "green";
    desenvolvimentoTecnico: "red" | "neutral" | "green";
    processosGestao: "red" | "neutral" | "green";
    aderenciaCampanhas: "red" | "neutral" | "green";
    qualityScore: number; // calculado: Red=-1, Neutro=0, Green=+1 (range -6 a +6)
}


export interface Interaction {
  id: string;
  type: InteractionType;
  date: string; // ISO 8601 string
  notes: string | OneOnOneNotes | N3IndividualNotes | N2IndividualNotes | QualityIndexNotes;
  authorId: string;
  riskScore?: number; // Add riskScore to interaction
  qualityScore?: number; // Add qualityScore to interaction (para Índice de Qualidade)
  nextInteractionDate?: string; // ISO 8601 string
  source?: string; // To identify the origin of the interaction (e.g., 'Pipedrive')
  sendEmailToAssessor?: boolean; // Controla se email será enviado ao assessor na reunião N3
}

export interface PDIAction {
  id: string;
  employeeId: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "To Do" | "In Progress" | "Completed";
}

export interface Diagnosis {
    status: "Concluído" | "Em Andamento" | "Pendente";
    date: string; // ISO 8601 string
    details: string;
}

export interface TeamMember extends User {
  team: string;
  position: string;
  lastOneOnOne: string;
  oneOnOneStatus: InteractionStatus;
  risk: {
    score: number;
    health: number;
    satisfaction: number;
    performance: number;
  };
  timeline: Interaction[];
  pdi: PDIAction[];
  diagnosis: Diagnosis;
}

// ==========================================
// PROJETOS INDEPENDENTES
// ==========================================

export interface Project {
  id: string;
  name: string;
  description: string;
  leaderId: string; // ID do documento employee no Firestore (ex: "MGV")
  leaderName: string;
  leaderEmail: string; // Email usado nas Firestore Rules para validação
  memberIds: string[]; // Array de IDs dos documentos employees
  memberEmails: string[]; // Array de emails dos membros (para validação nas rules)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isArchived?: boolean; // Para soft delete (arquivamento)
  interactionConfig?: ProjectInteractionConfig;
}

export interface ProjectInteractionConfig {
  hasScoring?: boolean; // Se tem pontuação
  hasRanking?: boolean; // Se tem ranking específico
  customFields?: { [key: string]: string }; // Campos customizados
}

export interface ProjectInteraction {
  id: string;
  projectId: string;
  type: "avisos" | "1:1" | "grupo"; // Tipo de interação do projeto
  date: string; // ISO 8601
  authorId: string; // ID do líder que criou
  authorEmail: string;
  notes: ProjectInteractionNotes;
  targetMemberId?: string; // Se for 1:1, ID do membro alvo
  targetMemberName?: string;
  targetMemberEmail?: string;
  targetMemberIds?: string[]; // Se for grupo, IDs dos membros
  targetMemberNames?: string[]; // Se for grupo, nomes dos membros
}

export interface ProjectInteractionNotes {
  content: string; // Conteúdo principal da anotação
  score?: number; // Pontuação (se configurado)
  indicator?: string; // Indicador de posição (1º, 2º, 3º, etc)
  customData?: { [key: string]: any }; // Dados customizados
}

// ============================
// PREMISSAS E PROJEÇÕES
// ============================

export interface PremissasConfig {
  cdiAnual: number; // Taxa CDI anual (%)
  impostoRepasse: number; // Imposto sobre repasse (%)
  multiplicadorB2B: number; // Multiplicador para assessores B2B (padrão: 0.50)
  multiplicadorMINST: number; // Multiplicador para assessores MINST (padrão: 0.25)
}

export interface Premissas {
  id: string;
  employeeId: string;
  year: number; // Ano da premissa (ex: 2026)
  aucInicial: number; // AUC inicial (Assets Under Custody)
  captacaoPrevista: number; // Captação prevista anual
  churnPrevisto: number; // Churn previsto anual
  roaPrevisto: number; // ROA previsto (%)
  tipoAssessor: "B2B" | "MINST"; // Tipo de assessor (detectado ou manual)
  createdAt: string; // ISO 8601
  createdBy: string; // Email do líder que criou
}