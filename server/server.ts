import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from "ws";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

// ES Module path resolution
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const TEMP_DIR = path.join(currentDirPath, "..", "temp");

// Ensure temp directory exists
try {
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
} catch (error) {
    console.error("Error creating temp directory:", error);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to clean translation response
function cleanTranslation(text: string): string {
    // Remove any text in parentheses
    text = text.replace(/\([^)]*\)/g, '');
    
    // Remove any text after a dash or hyphen
    text = text.split(/[-–—]/)[0];
    
    // Remove "In Khmer," prefix
    text = text.replace(/^In Khmer,?\s*/i, '');
    
    // Remove quotes
    text = text.replace(/["'"]/g, '');
    
    // Remove any explanatory text after a period
    text = text.split('.')[0];
    
    // Trim whitespace
    return text.trim();
}

const wss = new WebSocketServer({ port: 3001 });

wss.on("connection", (ws: WebSocket) => {
    console.log("New client connected");

    ws.on("message", async (message: Buffer) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === "audio") {
                try {
                    // Convert base64 to buffer
                    const buffer = Buffer.from(data.data, "base64");
                    console.log("Processing audio data...", { format: data.format });

                    // Create a temporary file
                    const tempFile = path.join(TEMP_DIR, `${Date.now()}.wav`);
                    await fs.promises.writeFile(tempFile, buffer);

                    try {
                        // Read the file and create a proper File object
                        const fileBuffer = await fs.promises.readFile(tempFile);
                        const file = new File([fileBuffer], path.basename(tempFile), {
                            type: "audio/wav",
                        });

                        // Transcribe with Whisper
                        const transcription = await openai.audio.transcriptions.create({
                            file,
                            model: "whisper-1",
                            language: "en",
                            response_format: "text",
                        });

                        console.log("Transcription:", transcription);

                        if (transcription) {
                            // Translate with GPT-4 Turbo
                            const translation = await openai.chat.completions.create({
                                model: "gpt-4o-mini", 
                                messages: [
                                    {
                                        role: "system",
                                        content: "You are a precise translator. Translate the input text to Khmer accurately, maintaining the original meaning and tone. Do not add any explanations or additional context. Do not ask questions. ONLY translate."
                                    },
                                    {
                                        role: "user",
                                        content: transcription
                                    }
                                ],
                                temperature: 0.1, // Lower temperature for more consistent translations
                                max_tokens: 500
                            });

                            const translatedText = translation.choices[0]?.message?.content || '';
                            const cleanedTranslation = cleanTranslation(translatedText);
                            console.log("Translation completed");

                            // Send back both transcription and translation
                            ws.send(
                                JSON.stringify({
                                    type: "translation",
                                    text: transcription,
                                    translation: cleanedTranslation,
                                })
                            );
                        }
                    } finally {
                        // Clean up temp file
                        await fs.promises.unlink(tempFile);
                    }
                } catch (error) {
                    console.error("Processing error:", error);
                    ws.send(
                        JSON.stringify({
                            type: "error",
                            message: error instanceof Error ? error.message : "Error processing audio",
                        })
                    );
                }
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

console.log("WebSocket server running on port 3001");
