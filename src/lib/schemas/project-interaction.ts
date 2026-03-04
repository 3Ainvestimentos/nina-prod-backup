import * as z from "zod";

export const projectInteractionFormSchema = z.object({
  type: z.enum(["1:1"]),
  targetMemberId: z.string().min(1, "Selecione um membro."),
  content: z.string().min(5, "As anotações devem ter pelo menos 5 caracteres."),
  indicator: z.string().optional(),
});

export type ProjectInteractionFormData = z.infer<
  typeof projectInteractionFormSchema
>;
