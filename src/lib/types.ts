

// This is a type definition file.
export type Role = "Colaborador" | "Líder" | "Diretor";

export type InteractionStatus = string;
// PDI is not a direct interaction type, it has its own table.
export type InteractionType = "1:1" | "Feedback" | "N3 Individual" | "Índice de Risco";

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


export interface Interaction {
  id: string;
  type: InteractionType;
  date: string; // ISO 8601 string
  notes: string | OneOnOneNotes | N3IndividualNotes;
  authorId: string;
  riskScore?: number; // Add riskScore to interaction
  nextInteractionDate?: string; // ISO 8601 string
  source?: string; // To identify the origin of the interaction (e.g., 'Pipedrive')
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
