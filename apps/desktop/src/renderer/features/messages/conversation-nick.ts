import type { ConversationParticipant } from "@lzt/shared";

export interface ConversationNickSource {
  title: string;
  interlocutorUsername: string;
  interlocutorUsernameHtml: string | null;
  interlocutorUsernameColor: string | null;
  interlocutorUserId: number | null;
  recipients: ConversationParticipant[];
  isSaved: boolean;
}

export const conversationNickProps = (
  c: ConversationNickSource,
  myUserId: number | null | undefined,
) => {
  if (c.isSaved) {
    return { username: c.title, html: null, color: null, enrich: false };
  }

  const other =
    myUserId != null
      ? c.recipients.find((r) => r.userId !== myUserId)
      : undefined;
  if (other) {
    return {
      username: other.username,
      html: other.usernameHtml,
      color: other.usernameColor,
      enrich: true,
    };
  }

  const creatorIsMe =
    c.interlocutorUserId != null &&
    myUserId != null &&
    c.interlocutorUserId === myUserId;
  if (creatorIsMe) {
    return { username: c.title, html: null, color: null, enrich: true };
  }

  return {
    username: c.interlocutorUsername || c.title,
    html: c.interlocutorUsernameHtml,
    color: c.interlocutorUsernameColor,
    enrich: true,
  };
};
