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
          summary: {
            type: "STRING",
            description: "A brief executive summary of the inspection findings based on the provided reference docs and URLs."
          },
          faults: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                timestamp: { type: "STRING", description: "Time format MM:SS" },
                component: { type: "STRING", description: "Name of the component (e.g., Junction Box, Control Valve, Transmitter)" },
                tagNumber: { type: "STRING", description: "Equipment tag number if visible in format like 20-FV-2300, JBS-203, TE-2312, 820-FC-563, etc. If not visible, mention 'Near [location text]' based on nearby visible text or signage" },
                faultType: { type: "STRING", description: "Short category of fault (e.g., Corrosion)" },
                description: { type: "STRING", description: "Detailed description of the visual defect" },
                severity: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] },
                standardGap: { type: "STRING", description: "Citation from the attached PDF standards or URL references that was violated" },
                recommendation: { type: "STRING", description: "Recommended maintenance action based on the standards" }
              },
              required: ["timestamp", "component", "tagNumber", "faultType", "description", "severity", "standardGap", "recommendation"]
            }
          }
        },
        required: ["summary", "faults"]
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
    You are a Senior Reliability Engineer at a refinery. 
    
    Input Data:
    1. A video footage of instrumentation systems (Control Valves, Transmitters, Junction Boxes).
    2. Reference Documents (PDFs): ${referenceFiles.length > 0 ? 'Provided attached.' : 'None.'}
    3. Reference Standards URLs: 
       ${referenceUrls.length > 0 ? referenceUrls.join('\n       ') : 'None.'}
    
    Your task:
    1. Analyze the video to identify visual faults such as rust, loose links, loose wires, gland packing issues, missing bolts/studs, damaged insulation, or leaks.
    2. **IDENTIFY EQUIPMENT TAG NUMBERS**: Look carefully for equipment tag numbers visible on the equipment or nearby signage. Tag numbers typically follow formats like:
       - 20-FV-2300
       - JBS-203
       - TE-2312
       - 820-FC-563
       - Similar alphanumeric patterns with hyphens
       If a tag number is clearly visible, record it exactly as shown.
       If no tag number is visible but there is nearby location text or signage, record it as "Near [location text]" (e.g., "Near Unit 3", "Near Pump Station A").
       If neither is visible, use "Not visible" or describe the general location.
    3. STRICTLY COMPARE the observed conditions against the specific requirements found in the provided PDF reference documents.
    4. For the provided URLs, rely on your internal knowledge base regarding the specific standards or best practices hosted at those links (e.g., OISD standards, API RP).
    5. Identify gaps where the equipment fails to meet these standards.
    6. Estimate the timestamp in the video where the fault is visible.

    Return the analysis in strict JSON format.
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