import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireAdmin } from "../middlewares/auth";
import { parseMobileNumber } from "../lib/mobile-number";

const router: IRouter = Router();

router.get("/sheets/weekly-settlement", requireAdmin, async (_req, res) => {
  const appsScriptUrl = process.env["APPS_SCRIPT_URL"] ?? process.env["GOOGLE_APPS_SCRIPT_URL"];
  if (!appsScriptUrl || !appsScriptUrl.startsWith("https://script.google.com/")) {
    res.status(500).json({
      success: false,
      message: "Apps Script URL is not configured on the server.",
    });
    return;
  }

  const url = new URL(appsScriptUrl);
  url.searchParams.set("action", "weeklySettlement");

  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "sheets/weekly-settlement: network error reaching Apps Script");
    res.status(502).json({ success: false, message: `Could not reach Apps Script: ${msg}` });
    return;
  }

  if (!response.ok) {
    res.status(502).json({
      success: false,
      message: `Apps Script returned HTTP ${response.status} ${response.statusText}.`,
    });
    return;
  }

  const result = (await response.json()) as {
    success?: boolean;
    message?: string;
    rows?: unknown[];
    data?: { rows?: unknown[] };
  };
  const rows = Array.isArray(result.rows) ? result.rows : Array.isArray(result.data?.rows) ? result.data.rows : [];

  res.json({ success: result.success ?? true, rows });
});

router.post("/sheets/sync", async (req, res) => {
  const { appsScriptUrl, payload } = req.body as {
    appsScriptUrl?: unknown;
    payload?: Record<string, unknown>;
  };

  if (
    !appsScriptUrl ||
    typeof appsScriptUrl !== "string" ||
    !appsScriptUrl.startsWith("https://script.google.com/")
  ) {
    res.status(400).json({
      success: false,
      message: "Invalid or missing Apps Script URL. It must start with https://script.google.com/",
    });
    return;
  }

  if (!payload || payload["action"] !== "saveFullProject") {
    res.status(400).json({
      success: false,
      message: "Invalid payload: missing or unknown action.",
    });
    return;
  }

  try {
    payload["mobileNumber"] = parseMobileNumber(payload["mobileNumber"]);
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : "Invalid mobile number." });
    return;
  }

  logger.info(
    { projectId: payload["projectId"], projectName: payload["projectName"] },
    "sheets/sync: forwarding to Apps Script"
  );

  let response: Response;
  try {
    response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "sheets/sync: network error reaching Apps Script");
    res.status(502).json({
      success: false,
      message: `Could not reach Apps Script: ${msg}`,
    });
    return;
  }

  if (!response.ok) {
    logger.error(
      { status: response.status, statusText: response.statusText },
      "sheets/sync: Apps Script returned non-OK status"
    );
    res.status(502).json({
      success: false,
      message: `Apps Script returned HTTP ${response.status} ${response.statusText}.`,
    });
    return;
  }

  let result: { success?: boolean; message?: string };
  try {
    result = (await response.json()) as { success?: boolean; message?: string };
  } catch {
    logger.warn("sheets/sync: Apps Script response was not valid JSON — treating as success");
    result = { success: true, message: "Synced to Google Sheets." };
  }

  logger.info({ result }, "sheets/sync: complete");

  res.json({
    success: result.success ?? true,
    message: result.message ?? "Synced to Google Sheets.",
  });
});

export default router;
