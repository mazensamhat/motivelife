import { getSession } from "@/lib/session";
import { badRequest, json, serverError, unauthorized } from "@/lib/api";
import {
  drivingReportPeriodOptions,
  getHouseholdDrivingReport,
  isDrivingReportPeriod,
} from "@/lib/family-map/driving-report";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const url = new URL(request.url);
    const periodRaw = url.searchParams.get("period") ?? "this_week";
    if (!isDrivingReportPeriod(periodRaw)) {
      return badRequest("Invalid period.");
    }

    try {
      const report = await getHouseholdDrivingReport({
        viewerUserId: session.id,
        period: periodRaw,
      });
      return json({
        report,
        periods: drivingReportPeriodOptions(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NO_HOUSEHOLD") return badRequest("Join a family first.");
      throw e;
    }
  } catch (error) {
    console.error("[api/family/driving-report]", error);
    return serverError("Could not load driving report.");
  }
}
