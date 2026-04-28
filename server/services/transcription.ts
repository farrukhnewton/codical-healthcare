interface StructuredMedicalRecord {
  patientName: string;
  patientAge: string;
  dateOfVisit: string;
  chiefComplaint: string;
  diagnosis: string;
  medications: string;
  dosage: string;
  doctorName: string;
  doctorNotes: string;
  followupDate: string;
}

interface TranscriptionResult {
  rawTranscript: string;
  structured: StructuredMedicalRecord;
}

interface GeminiErrorBody {
  error?: {
    message?: string;
  };
}

interface GeminiUploadResponse {
  file?: {
    uri?: string;
  };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiParsedResponse {
  rawTranscript?: string;
  patientName?: string;
  patientAge?: string;
  dateOfVisit?: string;
  chiefComplaint?: string;
  diagnosis?: string;
  medications?: string;
  dosage?: string;
  doctorName?: string;
  doctorNotes?: string;
  followupDate?: string;
}

const NOT_DETECTED = "Not detected";
const MAX_GEMINI_ATTEMPTS = 4;
const RETRYABLE_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const GEMINI_GENERATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const MEDICAL_PROMPT = `
You are an expert medical transcriptionist with deep
knowledge of clinical terminology, drug names,
medical procedures, and healthcare documentation.

Your task:
1. Transcribe the audio recording completely and
   accurately.
2. Pay special attention to:
   - Patient and doctor names
   - Medical conditions and diagnoses
   - Drug names, dosages, and frequencies
   - Symptoms and chief complaints
   - Follow-up instructions and dates
   - Numbers: ages, dosages, blood pressure readings,
     heart rates, temperatures

3. After transcribing, extract these fields.
   If a field is not mentioned in the audio, use
   exactly the string "Not detected" for that field.

Return ONLY a valid JSON object in this exact format.
No markdown. No extra text. No code blocks:
{
  "rawTranscript": "complete verbatim transcript",
  "patientName": "extracted value or Not detected",
  "patientAge": "extracted value or Not detected",
  "dateOfVisit": "extracted value or Not detected",
  "chiefComplaint": "extracted value or Not detected",
  "diagnosis": "extracted value or Not detected",
  "medications": "extracted value or Not detected",
  "dosage": "extracted value or Not detected",
  "doctorName": "extracted value or Not detected",
  "doctorNotes": "extracted value or Not detected",
  "followupDate": "extracted value or Not detected"
}

CRITICAL RULES:
- Your entire response must be a single valid
  complete JSON object
- Do not truncate any field values
- Do not wrap response in markdown code blocks
- Do not add any text before or after the JSON
- Every opened bracket and quote must be closed
- If transcript is very long, summarize doctor
  notes field rather than truncating the JSON
`;

function getMimeType(filename: string): string {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf("."));

  switch (extension) {
    case ".wav":
      return "audio/wav";
    case ".mp3":
      return "audio/mpeg";
    case ".flac":
      return "audio/flac";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    default:
      return "audio/wav";
  }
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(attempt: number, response?: Response): number {
  const retryAfter = response?.headers.get("retry-after");

  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);
    if (!Number.isNaN(retryAfterSeconds)) {
      return Math.min(retryAfterSeconds * 1000, 10000);
    }

    const retryAfterDate = Date.parse(retryAfter);
    if (!Number.isNaN(retryAfterDate)) {
      return Math.min(Math.max(retryAfterDate - Date.now(), 0), 10000);
    }
  }

  return Math.min(750 * 2 ** (attempt - 1), 6000);
}

async function fetchGeminiWithRetries(url: string, init: RequestInit): Promise<Response> {
  let lastFetchError: unknown = null;

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, init);

      if (
        response.ok ||
        !RETRYABLE_GEMINI_STATUSES.has(response.status) ||
        attempt === MAX_GEMINI_ATTEMPTS
      ) {
        return response;
      }

      const retryDelayMs = getRetryDelayMs(attempt, response);
      console.warn(
        `Gemini API returned ${response.status}; retrying in ${retryDelayMs}ms.`,
      );
      await delay(retryDelayMs);
    } catch (error) {
      lastFetchError = error;

      if (attempt === MAX_GEMINI_ATTEMPTS) {
        break;
      }

      const retryDelayMs = getRetryDelayMs(attempt);
      console.warn(
        `Gemini API request failed; retrying in ${retryDelayMs}ms.`,
      );
      await delay(retryDelayMs);
    }
  }

  const errorMessage =
    lastFetchError instanceof Error ? lastFetchError.message : "Unknown network error";
  throw new Error(
    `Could not reach Gemini transcription service after several attempts. ${errorMessage}`,
  );
}

async function handleGeminiError(response: Response) {
  const errorBody = await readJsonResponse<GeminiErrorBody>(response);
  const errorMessage = errorBody?.error?.message || "";

  if (response.status === 400) {
    throw new Error(
      "Audio file could not be processed. Please ensure it is a valid audio file.",
    );
  }

  if (response.status === 403 || errorMessage.includes("API key")) {
    throw new Error(
      "Invalid or expired Gemini API key. Please update GEMINI_API_KEY.",
    );
  }

  if (response.status === 429) {
    throw new Error(
      "Gemini API rate limit reached. Please try again in a moment.",
    );
  }

  if ([500, 502, 503, 504].includes(response.status)) {
    throw new Error(
      "Gemini transcription service is temporarily unavailable after several attempts. Please try again in a few minutes.",
    );
  }

  throw new Error(`Transcription service error: ${response.status}`);
}

function buildGenerateBody(part: { inline_data: { mime_type: string; data: string } } | { file_data: { mime_type: string; file_uri: string } }) {
  return {
    contents: [{
      parts: [
        part,
        {
          text: MEDICAL_PROMPT,
        },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };
}

async function callGenerateContent(apiKey: string, requestBody: ReturnType<typeof buildGenerateBody>) {
  let lastResponse: Response | null = null;

  for (const model of GEMINI_GENERATE_MODELS) {
    const response = await fetchGeminiWithRetries(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    if (response.ok) {
      return response;
    }

    lastResponse = response;

    if (!RETRYABLE_GEMINI_STATUSES.has(response.status)) {
      await handleGeminiError(response);
    }

    console.warn(
      `Gemini model ${model} returned ${response.status}; trying fallback model if available.`,
    );
  }

  if (lastResponse) {
    await handleGeminiError(lastResponse);
  }

  throw new Error(
    "Gemini transcription service is temporarily unavailable. Please try again in a few minutes.",
  );
}

async function uploadGeminiFile(apiKey: string, buffer: Buffer, mimeType: string) {
  const uploadResponse = await fetchGeminiWithRetries(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Command": "start, upload, finalize",
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "Content-Type": mimeType,
      },
      body: buffer,
    },
  );

  if (!uploadResponse.ok) {
    await handleGeminiError(uploadResponse);
  }

  const uploadJson = await readJsonResponse<GeminiUploadResponse>(uploadResponse);
  const fileUri = uploadJson?.file?.uri;

  if (!fileUri) {
    throw new Error("Gemini file upload did not return a file URI.");
  }

  return fileUri;
}

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
): Promise<TranscriptionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set in environment variables",
    );
  }

  const mimeType = getMimeType(filename);
  const fileSizeMB = buffer.length / (1024 * 1024);
  let response: Response;

  if (fileSizeMB <= 15) {
    const base64Audio = buffer.toString("base64");
    const requestBody = buildGenerateBody({
      inline_data: {
        mime_type: mimeType,
        data: base64Audio,
      },
    });

    response = await callGenerateContent(apiKey, requestBody);
  } else {
    const fileUri = await uploadGeminiFile(apiKey, buffer, mimeType);
    const requestBody = buildGenerateBody({
      file_data: {
        mime_type: mimeType,
        file_uri: fileUri,
      },
    });

    response = await callGenerateContent(apiKey, requestBody);
  }

  const responseJson = await response.json() as GeminiGenerateResponse;
  const rawText =
    responseJson
      ?.candidates?.[0]
      ?.content
      ?.parts?.[0]
      ?.text;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      "No transcription returned from Gemini API. Please try again.",
    );
  }

  // LAYER 1: Clean markdown code fences if present
  let cleanedText = rawText.trim();
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
  }

  // LAYER 2: Try direct JSON.parse on cleaned text
  let parsed: GeminiParsedResponse | null = null;
  const buildPartialResult = (): TranscriptionResult | null => {
    const transcriptMatch = cleanedText.match(
      /"rawTranscript"\s*:\s*"([\s\S]*?)(?:"|$)/,
    );

    if (!transcriptMatch) {
      return null;
    }

    return {
      rawTranscript: transcriptMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"'),
      structured: {
        patientName: NOT_DETECTED,
        patientAge: NOT_DETECTED,
        dateOfVisit: NOT_DETECTED,
        chiefComplaint: NOT_DETECTED,
        diagnosis: NOT_DETECTED,
        medications: NOT_DETECTED,
        dosage: NOT_DETECTED,
        doctorName: NOT_DETECTED,
        doctorNotes: NOT_DETECTED,
        followupDate: NOT_DETECTED,
      },
    };
  };

  try {
    parsed = JSON.parse(cleanedText) as GeminiParsedResponse;
  } catch (firstError) {
    void firstError;

    // LAYER 3: Extract JSON object with regex
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]) as GeminiParsedResponse;
      } catch (secondError) {
        void secondError;

        // LAYER 4: Fix truncated JSON by closing open braces and strings
        try {
          let attempt = jsonMatch[0];

          // If odd number of quotes close the last open string
          const quoteCount =
            (attempt.match(/(?<!\\)"/g) || []).length;
          if (quoteCount % 2 !== 0) {
            attempt = attempt + '"';
          }

          // Remove the last incomplete field
          const lastCommaIndex =
            attempt.lastIndexOf(",");
          const lastBraceIndex =
            attempt.lastIndexOf("{");
          if (lastCommaIndex > lastBraceIndex) {
            attempt =
              attempt.substring(0, lastCommaIndex);
          }

          // Close any unclosed braces
          const openBraces =
            (attempt.match(/\{/g) || []).length;
          const closeBraces =
            (attempt.match(/\}/g) || []).length;
          const bracesNeeded = openBraces - closeBraces;
          for (let i = 0; i < bracesNeeded; i++) {
            attempt = attempt + "}";
          }

          parsed = JSON.parse(attempt) as GeminiParsedResponse;
        } catch (thirdError) {
          void thirdError;

          // LAYER 5: Extract rawTranscript at minimum and return partial result
          const partialResult = buildPartialResult();

          if (partialResult) {
            return partialResult;
          }

          throw new Error(
            "Transcription completed but response was malformed. Please try again with a shorter audio file under 5 minutes.",
          );
        }
      }
    } else {
      const partialResult = buildPartialResult();

      if (partialResult) {
        return partialResult;
      }

      throw new Error(
        "Gemini did not return structured data. Audio may be unclear or in an unsupported language. Please try again.",
      );
    }
  }

  // Validate we have at least a transcript
  if (!parsed || !parsed.rawTranscript || parsed.rawTranscript.trim().length === 0) {
    throw new Error(
      "Audio transcription returned empty. Please ensure the audio has clear speech.",
    );
  }

  return {
    rawTranscript: parsed.rawTranscript,
    structured: {
      patientName: parsed.patientName || NOT_DETECTED,
      patientAge: parsed.patientAge || NOT_DETECTED,
      dateOfVisit: parsed.dateOfVisit || NOT_DETECTED,
      chiefComplaint: parsed.chiefComplaint || NOT_DETECTED,
      diagnosis: parsed.diagnosis || NOT_DETECTED,
      medications: parsed.medications || NOT_DETECTED,
      dosage: parsed.dosage || NOT_DETECTED,
      doctorName: parsed.doctorName || NOT_DETECTED,
      doctorNotes: parsed.doctorNotes || NOT_DETECTED,
      followupDate: parsed.followupDate || NOT_DETECTED,
    },
  };
}

export function parseTranscript(transcript: string) {
  void transcript;
  return {};
}
