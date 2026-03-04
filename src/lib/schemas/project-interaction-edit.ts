import * as z from "zod";

export const projectInteractionEditSchema = z.object({
  content: z.string().min(5, "As anotações devem ter pelo menos 5 caracteres."),
  indicator: z.string().optional(),
});

export type ProjectInteractionEditFormData = z.infer<
  typeof projectInteractionEditSchema
>;
