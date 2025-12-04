import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisResult } from "../types.ts";

const processFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:video/mp4;base64," or "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const analyzeVideo = async (
  videoFile: File,
  referenceFiles: File[],
  referenceUrls: string[],
  apiKey: string
): Promise<AnalysisResult> => {
  console.log('API Key length:', apiKey?.length);
  console.log('API Key starts with:', apiKey?.substring(0, 10));

  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          inspection_report: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                serial_no: { type: "INTEGER", description: "Sequential number starting from 1" },
                timestamp: { type: "STRING", description: "Time format MM:SS" },
                tag_number: { type: "STRING", description: "Equipment tag number (e.g., 20-FV-2300) or 'Near [location]' if not visible" },
                equipment_type: { type: "STRING", description: "Type of equipment (e.g., Pneumatic Control Valve, Pressure Transmitter)" },
                fault_type: { type: "STRING", description: "Category of fault (e.g., Gland Packing Leak, Corroded Junction Box)" },
                severity: { type: "STRING", enum: ["Low", "Medium", "High"] },
                corrective_action: { type: "STRING", description: "Recommended action with OISD/GDN standard reference" },
                remarks: { type: "STRING", description: "Detailed observation notes" }
              },
              required: ["serial_no", "timestamp", "tag_number", "equipment_type", "fault_type", "severity", "corrective_action", "remarks"]
            }
          }
        },
        required: ["inspection_report"]
      } as any,
      temperature: 0.2,
    }
  });

  // Process Video
  const base64Video = await processFileToBase64(videoFile);

  // Process Reference PDFs
  const pdfParts = await Promise.all(
    referenceFiles.map(async (file) => {
      const base64Pdf = await processFileToBase64(file);
      return {
        inlineData: {
          mimeType: file.type, // Should be 'application/pdf'
          data: base64Pdf
        }
      };
    })
  );

  const prompt = `
Role:
You are a Senior Field Instrumentation and Control Valve Inspector. Your task is to perform a detailed visual walkthrough of the provided video footage. You must detect faults, identify equipment tags, and ensure compliance with major industry standards without assuming dismantling or advanced diagnostics.

Reference Standards:
You must strictly cross-reference observed conditions against the following standards where applicable, alongside any provided PDF documents:
- OISD-STD-105 (Work Permit System)
- OISD-STD-106 (Pressure Relief & Disposal)
- OISD-STD-113 (Classification of Area for Electrical Installations)
- OISD-STD-116 (Fire Protection Facilities)
- OISD-STD-118 (Layouts for Oil & Gas Installations)
- OISD-STD-128 to 135 (Inspection of Pressure Vessels, Piping, Rotating Equipment, etc.)
- OISD-STD-137 (Inspection of Electrical Equipment)
- OISD-STD-152 (Safety Instrumentation)
- GDN-145 (Guidelines for Handling & Storage)

Additional Reference Documents: ${referenceFiles.length > 0 ? 'Provided as attachments.' : 'None.'}
Reference URLs: ${referenceUrls.length > 0 ? referenceUrls.join(', ') : 'None.'}

Instructions:
1. Analyze the Video: Scan the footage to identify field instrumentation and control valves. Estimate the timestamp for every observation.

2. Identify Equipment Tags:
   - Look for alphanumeric patterns (e.g., 20-FV-2300, JBS-203, TE-2312).
   - If a tag is visible, record it exactly.
   - If no tag is visible, use nearby text (e.g., "Near Unit 3") or describe the location.

3. Detect Visual Faults: Monitor strictly for the following conditions:

   ✅ Instrumentation Faults:
   - Physical Damage: Cracks, dents, deformation, broken/missing covers/glass.
   - Corrosion: Rust on bodies, brackets, connectors; pitting/flaking.
   - Loose/Missing Hardware: Unsecured bolts/nuts, missing nameplates/tags.
   - Cable/Conduit: Frayed cables, improper gland sealing (moisture risk), loose fittings, open junction boxes.
   - Ingress Protection: Open enclosures, water/dust/oil accumulation inside.
   - Orientation: Transmitters/gauges installed at incorrect angles.
   - Impulse Lines: Blocked lines, visible dirt, corrosion, or leaks.

   ✅ Control Valve Faults:
   - Leakage: Gland packing, actuator seals, flanges, or hydraulic oil leaks.
   - Actuator: Bent/broken linkages, rusted/seized arms.
   - Position Indicator: Broken, misaligned, or missing scale markings.
   - Coating: Peeling paint, exposed metal.
   - Vibration/Alignment: Excessive vibration, loose supports.
   - Air Supply: Damaged tubing/fittings, moisture/oil in air lines.
   - Manual Override: Handwheel engaged unintentionally, missing locking devices.

   ✅ General Observations:
   - Environmental: Dust, moisture, chemical exposure.
   - Labeling: Missing, faded, or illegible tags.
   - Safety: Missing guards, damaged insulation, steam/water impinging on instruments.

4. Determine Severity & Corrective Action:
   - Assign a severity level (Low/Medium/High) based on the risk to safety or process integrity.
   - Provide a Corrective Action based on the referenced OISD/GDN standards (e.g., "Restore gland sealing as per OISD-STD-137").

Output Format:
Return the analysis in STRICT JSON format as an inspection_report array.
  `;

  try {
    const result = await model.generateContent([
      // Video Part
      {
        inlineData: {
          mimeType: videoFile.type,
          data: base64Video
        }
      },
      // Spread all PDF parts
      ...pdfParts,
      // Text Prompt
      { text: prompt }
    ]);

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
};