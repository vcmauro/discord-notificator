// Extrae owner, repo, branch y filePath a partir de una URL de GitHub o "owner/repo"
function parseGithubTarget({ repoUrl, branch = "main", filePath = "STATUS.md" }) {
  if (!repoUrl || !repoUrl.trim()) {
    throw new Error("Falta githubStatus.repoUrl en config/settings.json");
  }

  const cleaned = repoUrl.trim().replace(/\.git$/i, "").replace(/\/+$/, "");

  // Caso 1: formato corto "owner/repo"
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    const parts = cleaned.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Enlace o repositorio inválido: ${repoUrl}`);
    }
    return {
      owner: parts[0],
      repo: parts[1],
      branch,
      filePath: filePath.replace(/^\/+/, ""),
    };
  }

  // Caso 2: URL de GitHub (ej. https://github.com/owner/repo o .../blob/branch/path/to/file.md)
  const url = new URL(cleaned);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new Error(`URL de repositorio inválida: ${repoUrl}`);
  }

  const owner = parts[0];
  const repo = parts[1];
  let resolvedBranch = branch;
  let resolvedPath = filePath.replace(/^\/+/, "");

  // Si la URL incluye /blob/<branch>/<ruta>, respetamos eso salvo que filePath se haya forzado distinto
  if (parts[2] === "blob" && parts.length >= 5) {
    resolvedBranch = parts[3];
    if (!filePath) {
      resolvedPath = parts.slice(4).join("/");
    }
  }

  return { owner, repo, branch: resolvedBranch, filePath: resolvedPath };
}

// Descarga y decodifica el archivo desde la API de GitHub
export async function fetchStatusFromGithub(githubConfig, githubToken = "") {
  const { owner, repo, branch, filePath } = parseGithubTarget(githubConfig);
  const encodedPath = filePath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "discord-notificator",
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(apiUrl, { headers });

  if (!res.ok) {
    throw new Error(`Error leyendo ${owner}/${repo} (${branch}:${filePath}) desde GitHub [${res.status}]: ${await res.text()}`);
  }

  const data = await res.json();

  if (!data?.content || data.encoding !== "base64") {
    throw new Error("La respuesta de GitHub no contenía un archivo en base64 válido.");
  }

  return Buffer.from(data.content, "base64").toString("utf8");
}