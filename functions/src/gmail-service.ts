import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/**
 * Formata o corpo do email N3 Individual em HTML
 */
export function formatN3EmailBody(
  interactionData: any,
  leaderName: string,
  employeeName: string
): string {
  const notes = interactionData.notes || {};
  const date = new Date(interactionData.date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Funções de formatação (igual ao frontend)
  const formatCurrency = (value: string | number | undefined) => {
    if (!value && value !== 0) return "N/A";
    const num = typeof value === "string" ? parseFloat(value.replace(',', '.')) : value;
    if (Number.isNaN(num)) return "N/A";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
  };

  const formatPercentage = (value: string | number | undefined) => {
    if (!value && value !== 0) return "N/A";
    const num = typeof value === "string" ? parseFloat(value.replace(',', '.')) : value;
    if (Number.isNaN(num)) return "N/A";
    return `${num.toFixed(2).replace(".", ",")}%`;
  };

  // Formatar os valores
  const captacao = formatCurrency(notes.captacao);
  const churnPF = formatPercentage(notes.churnPF);
  const roa = formatPercentage(notes.roa);
  const esforcos = notes.esforcos ? notes.esforcos.replace(/\n/g, "<br>") : "Não informado";
  const planoAcao = notes.planoAcao ? notes.planoAcao.replace(/\n/g, "<br>") : "Não informado";

  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        Resumo da Interação N3 Individual
      </h2>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p><strong>Data:</strong> ${date}</p>
        <p><strong>Líder:</strong> ${leaderName}</p>
        <p><strong>Colaborador:</strong> ${employeeName}</p>
      </div>

      <h3 style="color: #1f2937;">Indicadores Principais</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; background-color: #f9fafb;"><strong>Captação</strong></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${captacao}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; background-color: #f9fafb;"><strong>Churn PF</strong></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${churnPF}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; background-color: #f9fafb;"><strong>ROA</strong></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${roa}</td>
        </tr>
      </table>

      <h3 style="color: #1f2937;">Indicadores de Esforços</h3>
      <div style="background-color: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        ${esforcos}
      </div>

      <h3 style="color: #1f2937;">Plano de Ação</h3>
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px;">
        ${planoAcao}
      </div>
      
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280; text-align: center;">
        Este é um email automático gerado pela plataforma Nina.
      </p>
    </div>
  `;
}

/**
 * Envia email usando a API do Gmail
 */
export async function sendEmail(
  auth: OAuth2Client,
  to: string[],
  subject: string,
  htmlBody: string
) {
  try {
    console.log(`[EmailService] Iniciando montagem do email para: ${to.join(", ")}`);
    
    const gmail = google.gmail({ version: "v1", auth: auth as any });
    
    // Codificação Base64URL para RFC 2822
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const messageParts = [
      `To: ${to.join(", ")}`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${utf8Subject}`,
      "",
      htmlBody,
    ];
    
    const message = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    console.log(`[EmailService] Tamanho do corpo codificado: ${encodedMessage.length} bytes`);
    console.log("[EmailService] Enviando requisição para Gmail API...");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[EmailService] ✅ Email enviado com sucesso! ID: ${res.data.id}`);
    return res.data;
  } catch (error: any) {
    console.error("[EmailService] ❌ Erro ao enviar email:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    throw error; // Re-lança para ser tratado no chamador
  }
}

