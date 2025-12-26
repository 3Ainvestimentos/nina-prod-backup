// functions/src/calendar-events.ts
import * as functions from "firebase-functions/v1";
import { auth, db } from "./admin-app";
import { google } from "googleapis";
import { getOAuth2Client } from "./google-auth";
import { decrypt, isEncrypted, removeEncryptionMark } from "./kms-utils";

export const createCalendarEvent = async (interactionData: any, employeeId: string) => {
  try {
    const { nextInteractionDate, type, authorId } = interactionData;
    if (!nextInteractionDate || !authorId) return;

    const authorUser = await auth.getUser(authorId).catch(() => null);
    if (!authorUser?.email) return;

    const leaderQuery = await db.collection("employees").where("email", "==", authorUser.email).limit(1).get();
    if (leaderQuery.empty) return;

    const leaderData = leaderQuery.docs[0].data();
    let refreshToken = leaderData?.googleAuth?.refreshToken;
    if (refreshToken && isEncrypted(refreshToken)) {
      refreshToken = await decrypt(removeEncryptionMark(refreshToken)).catch(() => null);
    }
    if (!refreshToken) return;

    const employeeDoc = await db.collection("employees").doc(employeeId).get();
    const employeeData = employeeDoc.data();
    if (!employeeData?.email) return;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client as any });

    const startDateTime = new Date(nextInteractionDate);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `${type} - ${employeeData.name || "Colaborador"}`,
        description: `Agendado via Nina 1.0`,
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() },
        attendees: [{ email: employeeData.email }, { email: authorUser.email }],
      },
    });
  } catch (error) {
    functions.logger.error(`[Calendar] Erro:`, error);
  }
};
