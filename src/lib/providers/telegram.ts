import type { TokenSet } from "./types";
import type {
  AccountInfo,
  FormatCapability,
  Provider,
  PublishHandle,
} from "./types";
import { PermanentError } from "./errors";

const API = "https://api.telegram.org";

const CAPS: FormatCapability[] = [
  {
    format: "text",
    media: { min: 0, max: 0, kinds: [] },
    caption: { maxLength: 4096, required: true },
    mediaIngestion: "pull_url",
  },
  {
    format: "image",
    media: { min: 1, max: 1, kinds: ["image"] },
    caption: { maxLength: 1024, required: false },
    mediaIngestion: "pull_url",
  },
];

function telegramUrl(token: string, method: string): string {
  return `${API}/bot${token}/${method}`;
}

async function telegramRequest(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  console.log(`[telegram] API request: ${method}`);

  const res = await fetch(telegramUrl(token, method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: Record<string, unknown>;
    description?: string;
    error_code?: number;
  };

  if (!res.ok || !json.ok) {
    console.error(
      `[telegram] API error: ${method} HTTP=${res.status} description=${json.description ?? "unknown"}`,
    );

    throw new PermanentError(
      `telegram: ${json.description ?? `HTTP ${res.status}`}`,
    );
  }

  console.log(`[telegram] API success: ${method}`);

  return json.result ?? {};
}

export const telegramProvider: Provider = {
  id: "telegram",
  label: "Telegram",

  capabilities: () => CAPS,

  connectionModes: () => ["manual_token"],

  requiresTokenRefresh: () => false,

  async healthCheck(tokens: TokenSet): Promise<AccountInfo> {
    console.log("[telegram] healthCheck");

    const result = await telegramRequest(tokens.accessToken, "getMe", {});

    const id = String(result.id ?? "");

    if (!id) {
      throw new PermanentError("telegram: bot id missing");
    }

    return {
      accountId: id,
      displayName:
        typeof result.first_name === "string"
          ? result.first_name
          : typeof result.username === "string"
            ? result.username
            : `Telegram bot ${id}`,
      handle:
        typeof result.username === "string"
          ? `@${result.username}`
          : undefined,
    };
  },

  async refreshToken(tokens: TokenSet): Promise<TokenSet> {
    return tokens;
  },

  async publish({
    tokens,
    accountId,
    request,
    mediaUrls,
    channelMetadata,
  }): Promise<PublishHandle> {
    console.log(
      `[telegram] publish start: format=${request.format} accountId=${accountId}`,
    );

    const chatId =
      typeof channelMetadata?.chatId === "string"
        ? channelMetadata.chatId
        : accountId;

    if (!chatId) {
      throw new PermanentError(
        "telegram: chatId is required for publishing",
      );
    }

    console.log(`[telegram] publish target chatId=${chatId}`);

    if (request.format === "text") {
      console.log("[telegram] sending text");

      const result = await telegramRequest(
        tokens.accessToken,
        "sendMessage",
        {
          chat_id: chatId,
          text: request.caption ?? "",
        },
      );

      const messageId = String(result.message_id ?? "");

      if (!messageId) {
        throw new PermanentError(
          "telegram: sendMessage returned no message_id",
        );
      }

      console.log(
        `[telegram] PUBLISHED text message_id=${messageId}`,
      );

      return {
        providerHandle: messageId,
      };
    }

    if (request.format === "image") {
      const imageUrl = mediaUrls[0];

      if (!imageUrl) {
        throw new PermanentError(
          "telegram: image publishing requires media URL",
        );
      }

      console.log("[telegram] sending photo");

      const result = await telegramRequest(
        tokens.accessToken,
        "sendPhoto",
        {
          chat_id: chatId,
          photo: imageUrl,
          ...(request.caption
            ? { caption: request.caption }
            : {}),
        },
      );

      const messageId = String(result.message_id ?? "");

      if (!messageId) {
        throw new PermanentError(
          "telegram: sendPhoto returned no message_id",
        );
      }

      console.log(
        `[telegram] PUBLISHED photo message_id=${messageId}`,
      );

      return {
        providerHandle: messageId,
      };
    }

    throw new PermanentError(
      `telegram: unsupported format '${request.format}'`,
    );
  },
};
