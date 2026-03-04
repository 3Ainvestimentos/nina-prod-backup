import * as z from "zod";

export const diagnosisSchema = z.object({
  status: z.enum(["Pendente", "Em Andamento", "Concluído"]),
  details: z.string().optional(),
});

export type DiagnosisFormData = z.infer<typeof diagnosisSchema>;
