import * as z from "zod";

export const projectFormSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres."),
  leaderId: z.string().optional(),
  memberIds: z.array(z.string()).min(1, "Selecione pelo menos um membro."),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;
