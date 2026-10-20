
export interface Config {
  slackBotToken: string;
	slackAppToken: string;
	publicBaseUrl: string;
	port: number;
	nodeEnv: string;
	logLevel: string;
}

function required(name: string) {
	const value = process.env[name];
  if (!value || value.trim() === "") {
		throw new Error(
      `Missing env variable: ${name}. ` +
        `See .env.example. NEVER commit real values.`,
    );
  }
	return value.trim();
}

function optional(name: string, fallback: string): string {
	const value = process.env[name];
	return value && value.trim() !== "" ? value.trim() : fallback;
}

export function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function loadConfig(): Config {
  const publicBaseUrl = normalizeBaseUrl(required("PUBLIC_BASE_URL"));

  if (!/^https:\/\//.test(publicBaseUrl)) {
    throw new Error(
      "PUBLIC_BASE_URL must start with a https://, Slack will not load a " +
        "HTTP preview_url inside.",
    );
  }

	const portRaw = optional("PORT", "3000");
	const port = Number.parseInt(portRaw, 10);
	if (!Number.isInteger(port) || port <=  0 || port > 65535) {
    throw new Error(`PORT var needs to be a valid port number, got: ${portRaw}`);
  }

	return {
		slackBotToken: required("SLACK_BOT_TOKEN"),
		slackAppToken: required("SLACK_APP_TOKEN"),
		publicBaseUrl,
		port,
		nodeEnv: optional("NODE_ENV", "development"),
		logLevel: optional("LOG_LEVEL", "info"),
	};
}