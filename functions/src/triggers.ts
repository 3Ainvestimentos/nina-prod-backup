// functions/src/triggers.ts
import * as functions from "firebase-functions/v1";
import { auth, db } from "./admin-app";
import { updateLeaderRanking } from "./update-ranking";
import { createCalendarEvent } from "./calendar-events";
import { getOAuth2Client } from "./google-auth";
import { formatN3EmailBody, sendEmail } from "./gmail-service";
import { decrypt, isEncrypted, removeEncryptionMark } from "./kms-utils";

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

export const onInteractionCreate = functions
  .region(REGION)
  .firestore.document("/employees/{employeeId}/interactions/{interactionId}")
  .onCreate(async (snap, context) => {
    const { employeeId } = context.params;
    const interactionData = snap.data();

    functions.logger.log("[Interactions] onInteractionCreate disparado", {
      employeeId,
      interactionId: context.params.interactionId,
      type: interactionData?.type,
    });

    const tasks: Promise<any>[] = [updateLeaderRanking(employeeId)];
    if (interactionData) tasks.push(createCalendarEvent(interactionData, employeeId));

    if (interactionData?.type === "N3 Individual" && interactionData.sendEmailToAssessor === true && interactionData.authorId) {
      tasks.push((async () => {
        try {
          const authorUser = await auth.getUser(interactionData.authorId).catch(() => null);
          const authorEmail = authorUser?.email;
          if (!authorEmail) return;

          const leaderQuery = await db.collection("employees").where("email", "==", authorEmail).limit(1).get();
          if (leaderQuery.empty) return;

          const leaderDoc = leaderQuery.docs[0];
          const leaderData = leaderDoc.data();
          let refreshToken = leaderData?.googleAuth?.refreshToken;
          const savedScope = leaderData?.googleAuth?.scope;

          if (refreshToken && isEncrypted(refreshToken)) {
            refreshToken = await decrypt(removeEncryptionMark(refreshToken)).catch(() => null);
          }

          const scopeString = typeof savedScope === 'string' ? savedScope : (Array.isArray(savedScope) ? savedScope.join(' ') : '');
          if (!refreshToken || !scopeString.includes('gmail.send')) return;

          const employeeDoc = await db.collection("employees").doc(employeeId).get();
          const employeeData = employeeDoc.data();
          if (!employeeData?.email) return;

          const oauth2Client = getOAuth2Client();
          oauth2Client.setCredentials({ refresh_token: refreshToken });

          const htmlBody = formatN3EmailBody(interactionData, leaderData.name || "Líder", employeeData.name || "Colaborador");
          const recipients = [employeeData.email];
          if (authorEmail !== employeeData.email) recipients.push(authorEmail);

          await sendEmail(oauth2Client as any, recipients, `Resumo da Interação N3 Individual - ${employeeData.name}`, htmlBody);
        } catch (error) {
          functions.logger.error(`[EmailN3] Erro:`, error);
        }
      })());
    }

    return Promise.all(tasks).catch(e => functions.logger.error(`[Interactions] Erro:`, e));
  });

export const onPdiWrite = functions
  .region(REGION)
  .firestore.document("/employees/{employeeId}/pdiActions/{pdiId}")
  .onWrite(async (change, context) => {
    const { employeeId } = context.params;
    return updateLeaderRanking(employeeId).catch(e => functions.logger.error(`[PDI] Erro:`, e));
  });
