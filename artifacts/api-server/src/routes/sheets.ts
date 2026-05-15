import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
