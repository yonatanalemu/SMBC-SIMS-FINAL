import "dotenv/config";

// Last line of defense, beyond express-async-errors: if something ever
// throws or rejects completely outside a request's lifecycle (extremely
// rare, but possible), log it and keep the server running instead of
// letting Node's default behavior kill the whole process.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
// Fail fast and loud on weak/placeholder secrets rather than silently
// booting an insecurely-configured production instance — the .env.example
// defaults ("change-me-access"/"change-me-refresh") are exactly the kind of
// thing that ends up still in place in a real deployment if nothing ever
// forces the issue. Skippable for local/dev convenience via ALLOW_WEAK_SECRETS.
const WEAK_SECRETS = new Set(["change-me-access", "change-me-refresh", "secret", "changeme", ""]);
function assertStrongSecret(name) {
  const value = process.env[name] || "";
  if (process.env.ALLOW_WEAK_SECRETS === "true") return;
  if (WEAK_SECRETS.has(value) || value.length < 32) {
    console.error(
      `\nRefusing to start: ${name} is missing, a known placeholder, or too short (needs 32+ random characters).\n` +
      `Generate one with: openssl rand -base64 48\n` +
      `(Set ALLOW_WEAK_SECRETS=true to bypass this check for local development only — never in production.)\n`
    );
    process.exit(1);
  }
}
assertStrongSecret("JWT_ACCESS_SECRET");
assertStrongSecret("JWT_REFRESH_SECRET");

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SMBC SIMS v2 backend running on port ${PORT}`);
});
