import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthedClient } from "@/lib/integrations/google";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get("spreadsheetId");
    const range = url.searchParams.get("range");

    if (!spreadsheetId || !range) {
      return NextResponse.json(
        { error: "Missing required query params: spreadsheetId, range" },
        { status: 400 }
      );
    }

    const auth = await getAuthedClient();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return NextResponse.json({
      range: res.data.range,
      values: res.data.values || [],
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Failed to read spreadsheet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { spreadsheetId, range, values, title } = await request.json();

    const auth = await getAuthedClient();
    const sheets = google.sheets({ version: "v4", auth });

    // If no spreadsheetId provided, create a new spreadsheet
    if (!spreadsheetId) {
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title || "Untitled Spreadsheet",
          },
        },
      });

      const newId = createRes.data.spreadsheetId;

      // If values provided, write them to the new spreadsheet
      if (values && Array.isArray(values) && values.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: newId!,
          range: range || "Sheet1!A1",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values,
          },
        });
      }

      return NextResponse.json({
        success: true,
        spreadsheetId: newId,
        spreadsheetUrl: createRes.data.spreadsheetUrl,
      });
    }

    // Append rows to existing spreadsheet
    if (!range || !values) {
      return NextResponse.json(
        { error: "Missing required fields: range, values" },
        { status: 400 }
      );
    }

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({
      success: true,
      updatedRange: res.data.updates?.updatedRange,
      updatedRows: res.data.updates?.updatedRows,
      updatedCells: res.data.updates?.updatedCells,
    });
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to write to spreadsheet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
