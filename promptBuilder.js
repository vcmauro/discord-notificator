import fs from "node:fs/promises";
import path from "node:path";

async function readFileSafe(relativePath, fallback = "") {
  try {
    return await fs.readFile(path.resolve(process.cwd(), relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function getTodayISO(timeZone = "America/Lima") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function applyPlaceholders(template, vars) {
  let output = template;
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output.trim();
}

// Construye systemPrompt y userPrompt a partir de archivos externos
export async function buildPromptMessages({ statusContent, todayISO }) {
  const systemTemplate = await readFileSafe("config/system.md", "");
  const userTemplate = await readFileSafe(
    "config/user.md",
    "Fecha actual: {{TODAY}}\n\nEstado:\n{{STATUS}}"
  );

  const safeStatus = statusContent.trim() || "Sin contenido de estado disponible.";

  const systemPrompt = systemTemplate.trim();
  const userPrompt = applyPlaceholders(userTemplate, {
    TODAY: todayISO,
    STATUS: safeStatus,
  });

  return { systemPrompt, userPrompt };
}