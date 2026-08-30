import { JWT } from "google-auth-library";
import type { Cell } from "@/lib/report/view";

/**
 * Google Sheets + Drive access for the event report (Admin_Event_PDF.md §3):
 * one shared cafe service account, never a per-admin OAuth login. Every report
 * artifact (one Sheet, one PDF per event) is created inside a single Drive
 * folder the cafe owns and has shared with the service account as Editor —
 * `GOOGLE_DRIVE_FOLDER_ID`. A second click refreshes those two files in place.
 *
 * Google Cloud project decision (§10): the project started for "Sign in with
 * Google" (HANDOFF.md §2) is reused. Enabling the Sheets API and the Drive API
 * and adding a service account are project-scoped, additive actions that do
 * not touch the existing OAuth client or consent screen — there is no reason
 * to create a second project. The service-account path needs no consent
 * screen at all, so the unfinished Sign-in-with-Google consent work does not
 * block this.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";

function credentials(): { email: string; key: string } | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, key: parsed.private_key };
      }
    } catch {
      return null;
    }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (email && key) {
    // `\n` in a single-line env var must become real newlines for the PEM.
    return { email, key: key.replace(/\\n/g, "\n") };
  }
  return null;
}

/** True when the service account and target folder are configured. */
export function reportingConfigured(): boolean {
  return Boolean(credentials() && FOLDER_ID);
}

let cachedClient: JWT | null = null;
function client(): JWT {
  if (cachedClient) return cachedClient;
  const creds = credentials();
  if (!creds) throw new Error("Google service account not configured");
  cachedClient = new JWT({ email: creds.email, key: creds.key, scopes: SCOPES });
  return cachedClient;
}

async function token(): Promise<string> {
  const { token } = await client().getAccessToken();
  if (!token) throw new Error("Could not obtain a Google access token");
  return token;
}

async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google API ${res.status} ${init.method ?? "GET"} ${url} — ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const SHEET_TITLE = "Report";
const GRID_RANGE = `${SHEET_TITLE}!A1:Z100000`;

async function spreadsheetExists(id: string): Promise<boolean> {
  try {
    await api(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId`
    );
    return true;
  } catch {
    return false;
  }
}

async function createSpreadsheet(
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const created = await api<{ spreadsheetId: string; spreadsheetUrl: string }>(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: SHEET_TITLE } }],
      }),
    }
  );
  // Newly created by the service account it lands in the SA's own Drive root;
  // move it into the cafe's shared folder so the cafe controls access.
  await api(
    `https://www.googleapis.com/drive/v3/files/${created.spreadsheetId}` +
      `?addParents=${FOLDER_ID}&removeParents=root&supportsAllDrives=true&fields=id`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }
  );
  return created;
}

async function writeSheetValues(spreadsheetId: string, values: Cell[][]): Promise<void> {
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
      `${encodeURIComponent(GRID_RANGE)}:clear`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
  );
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
      `${encodeURIComponent(`${SHEET_TITLE}!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
}

async function renameSpreadsheet(spreadsheetId: string, title: string): Promise<void> {
  await api(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            updateSpreadsheetProperties: {
              properties: { title },
              fields: "title",
            },
          },
        ],
      }),
    }
  );
}

async function pdfFileExists(id: string): Promise<boolean> {
  try {
    await api(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=id&supportsAllDrives=true`
    );
    return true;
  } catch {
    return false;
  }
}

async function createPdfFile(name: string): Promise<string> {
  const file = await api<{ id: string }>(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parents: [FOLDER_ID],
        mimeType: "application/pdf",
      }),
    }
  );
  return file.id;
}

async function uploadPdfMedia(id: string, pdf: Buffer): Promise<void> {
  await api(
    `https://www.googleapis.com/upload/drive/v3/files/${id}` +
      `?uploadType=media&supportsAllDrives=true&fields=id`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(pdf),
    }
  );
}

async function renamePdfFile(id: string, name: string): Promise<void> {
  await api(
    `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }
  );
}

async function webViewLink(id: string): Promise<string> {
  const file = await api<{ webViewLink?: string }>(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=webViewLink&supportsAllDrives=true`
  );
  return file.webViewLink ?? `https://drive.google.com/file/d/${id}/view`;
}

export type ReportArtifacts = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  pdfFileId: string;
  pdfUrl: string;
};

/**
 * Creates the Sheet + PDF on first call, refreshes them in place afterwards.
 * `existing` carries whatever `event.report` already holds (empty strings on
 * first ever click). Returns the ids/urls to persist back onto the event.
 */
export async function syncEventReport(params: {
  existing: { spreadsheetId: string; pdfFileId: string };
  title: string;
  sheetValues: Cell[][];
  pdf: Buffer;
}): Promise<ReportArtifacts> {
  const { existing, title, sheetValues, pdf } = params;
  const pdfName = `${title}.pdf`;

  const haveSheet =
    existing.spreadsheetId && (await spreadsheetExists(existing.spreadsheetId));
  const sheet = haveSheet
    ? {
        spreadsheetId: existing.spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existing.spreadsheetId}/edit`,
      }
    : await createSpreadsheet(title);

  if (haveSheet) await renameSpreadsheet(sheet.spreadsheetId, title);
  await writeSheetValues(sheet.spreadsheetId, sheetValues);

  const havePdf = existing.pdfFileId && (await pdfFileExists(existing.pdfFileId));
  const pdfFileId = havePdf ? existing.pdfFileId : await createPdfFile(pdfName);
  if (havePdf) await renamePdfFile(pdfFileId, pdfName);
  await uploadPdfMedia(pdfFileId, pdf);

  return {
    spreadsheetId: sheet.spreadsheetId,
    spreadsheetUrl: sheet.spreadsheetUrl,
    pdfFileId,
    pdfUrl: await webViewLink(pdfFileId),
  };
}
