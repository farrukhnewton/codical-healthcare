import { db } from "../../db";
import { patients, encounters, clinicalNotes, auditLogs, assignments } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DRCHRONO_BASE = "https://drchrono.com/api";

export interface DrChronoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class DrChronoService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  async getAuthUrl(): Promise<string> {
    const params = new URLSearchParams({
      redirect_uri: this.redirectUri,
      response_type: "code",
      client_id: this.clientId,
      scope: "patients:read patients:summary:read calendar:read clinical:read",
    });
    return `${DRCHRONO_BASE}/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<DrChronoTokenResponse> {
    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(`${DRCHRONO_BASE}/oauth2/token/`, {
      method: "POST",
      body: params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`DrChrono Token Exchange Failed: ${error}`);
    }

    return await res.json();
  }

  async fetchPatients(accessToken: string): Promise<any[]> {
    const res = await fetch(`${DRCHRONO_BASE}/patients`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch patients from DrChrono");
    const data = await res.json();
    return data.results || [];
  }

  async fetchAppointments(accessToken: string, dateStart?: string): Promise<any[]> {
    const url = new URL(`${DRCHRONO_BASE}/appointments`);
    if (dateStart) url.searchParams.set("date", dateStart);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch appointments from DrChrono");
    const data = await res.json();
    return data.results || [];
  }

  async fetchClinicalNote(accessToken: string, appointmentId: string): Promise<string> {
    const res = await fetch(`${DRCHRONO_BASE}/clinical_notes?appointment=${appointmentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return "Note not found or inaccessible.";
    const data = await res.json();
    // DrChrono notes are structured; we'll join them into a readable text block for now
    if (data.results && data.results.length > 0) {
      const note = data.results[0];
      return JSON.stringify(note, null, 2); // Simple for now, can beautify later
    }
    return "No note results.";
  }

  async syncToDatabase(accessToken: string, userId: number) {
    const drPatients = await this.fetchPatients(accessToken);
    
    for (const drPatient of drPatients) {
      // 1. Check if patient exists
      const existing = await db.select().from(patients)
        .where(and(eq(patients.emrId, drPatient.id.toString()), eq(patients.emrType, 'drchrono')))
        .limit(1);

      let patientId: number;
      if (existing[0]) {
        patientId = existing[0].id;
      } else {
        const inserted = await db.insert(patients).values({
          emrId: drPatient.id.toString(),
          emrType: 'drchrono',
          firstName: drPatient.first_name,
          lastName: drPatient.last_name,
          dob: drPatient.date_of_birth,
          gender: drPatient.gender,
          email: drPatient.email,
          phone: drPatient.cell_phone || drPatient.home_phone,
          mrn: drPatient.chart_id,
        }).returning();
        patientId = inserted[0].id;
      }

      // 2. Fetch appointments for this patient (simplified: fetch all and filter or fetch latest)
      const appointments = await this.fetchAppointments(accessToken);
      const patientAppointments = appointments.filter(a => a.patient === drPatient.id);

      for (const appt of patientAppointments) {
        const existingEncounter = await db.select().from(encounters)
          .where(and(eq(encounters.emrId, appt.id.toString()), eq(encounters.emrType, 'drchrono')))
          .limit(1);

        if (!existingEncounter[0]) {
          const insertedEncounter = await db.insert(encounters).values({
            patientId,
            emrId: appt.id.toString(),
            emrType: 'drchrono',
            date: new Date(appt.scheduled_time),
            providerName: "EMR Provider", // Could fetch provider details too
            encounterType: appt.reason,
            status: 'pending',
          }).returning();

          // 3. Fetch clinical note
          const noteContent = await this.fetchClinicalNote(accessToken, appt.id.toString());
          await db.insert(clinicalNotes).values({
            encounterId: insertedEncounter[0].id,
            content: noteContent,
            noteType: 'soap',
          });

          // 4. Create assignment to the current user
          await db.insert(assignments).values({
            encounterId: insertedEncounter[0].id,
            userId,
            status: 'assigned',
          });
        }
      }
    }

    // Log the sync action
    await db.insert(auditLogs).values({
      userId,
      action: "EMR_SYNC",
      entityType: "EMR_DRCHRONO",
      details: { patientCount: drPatients.length },
    });
  }
}
