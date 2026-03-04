import * as z from "zod";

export const pdiActionSchema = z.object({
  description: z.string().min(1, "A descrição da ação é obrigatória."),
  startDate: z.date({
    required_error: "A data de início é obrigatória.",
  }),
  endDate: z.date({
    required_error: "A data de prazo é obrigatória.",
  }),
  status: z.enum(["To Do", "In Progress", "Completed"]),
});

export type PdiActionFormData = z.infer<typeof pdiActionSchema>;
