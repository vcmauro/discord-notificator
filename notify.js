import fs from "node:fs/promises";
import path from "node:path";
import { buildPromptMessages, getTodayISO } from "./promptBuilder.js";
import { fetchStatusFromGithub } from "./githubStatus.js";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const aiApiKey = process.env.AI_API_KEY;
const githubToken = process.env.GITHUB_TOKEN || "";

if (!webhookUrl || !aiApiKey) {
  console.error("Falta DISCORD_WEBHOOK_URL o AI_API_KEY en .env");
  process.exit(1);
}

async function readFileSafe(relativePath, fallback = "") {
  try {
    return await fs.readFile(path.resolve(process.cwd(), relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function loadSettings() {
  const raw = await readFileSafe("config/settings.json");
  if (!raw) throw new Error("No se encontró config/settings.json");

  const settings = JSON.parse(raw);
  if (!settings?.ai?.baseUrl || !settings?.ai?.model) {
    throw new Error("Falta ai.baseUrl o ai.model en config/settings.json");
  }

  return settings;
}

async function generateMessage(aiConfig, { systemPrompt, userPrompt }) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const endpoint = `${aiConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`Error API (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("El modelo no devolvió texto.");

  return text.slice(0, 2000);
}

async function sendToDiscord(content) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error(`Error Discord (${res.status}): ${await res.text()}`);
  }
}

async function main() {
  const settings = await loadSettings();
  const statusContent = await fetchStatusFromGithub(settings.githubStatus || {}, githubToken);
  const todayISO = getTodayISO(settings.timezone || "America/Lima");

  const promptMessages = await buildPromptMessages({ statusContent, todayISO });
  const notification = await generateMessage(settings.ai, promptMessages);
  await sendToDiscord(notification);

  console.log(`Enviado con [${settings.ai.model}]:\n` + notification);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});