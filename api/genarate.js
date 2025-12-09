// This file must be placed in a directory named 'api'
const { GoogleGenAI } = require('@google/genai');

// The key is securely retrieved from Vercel's environment variables
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT_BASE = (theme, valueInstruction) => `
You are the Persian Cultural Alignment Model (PCAM). Your task is to generate a short, creative, child-friendly story based on Persian folklore and traditions, ensuring cultural fidelity.
1. THEME: The story MUST be centered on the '${theme}' theme and use relevant cultural symbols (e.g., Haft-Seen items).
2. ALIGNMENT: The narrative MUST strictly adhere to the cultural value: '${valueInstruction}'. Soften any dark or violent elements often found in classic folklore.
3. LANGUAGE: The Farsi translation must be localized (natural-sounding for a diaspora child) and NOT a literal, awkward word-for-word translation.
4. TONE: The language and tone must be suitable for a preschool child: warm, playful, and serene.
5. FORMAT: Your output must be a single JSON object structured EXACTLY as defined in the response schema.
`;

const PCAM_SCHEMA = {
    type: "OBJECT",
    properties: {
        title_en: { type: "STRING", description: "The story title in English." },
        title_fa: { type: "STRING", description: "The story title in Farsi." },
        cultural_footnote: { type: "STRING", description: "A short, playful footnote explaining the main cultural element (e.g., Haft-Seen) for parents." },
        story_pairs: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    en: { type: "STRING", description: "The story text in English." },
                    fa: { type: "STRING", description: "The culturally localized story text in Farsi." }
                },
                propertyOrdering: ["en", "fa"]
            }
        }
    },
    propertyOrdering: ["title_en", "title_fa", "cultural_footnote", "story_pairs"]
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { userTopic, theme, valueInstruction } = req.body;

        if (!userTopic || !theme || !valueInstruction) {
            return res.status(400).json({ message: 'Missing required parameters (topic, theme, or value).' });
        }

        const systemPrompt = SYSTEM_PROMPT_BASE(theme, valueInstruction);

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-09-2025',
            contents: [{ role: 'user', parts: [{ text: `Generate story about: ${userTopic}` }] }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: PCAM_SCHEMA,
            },
        });
        
        const jsonText = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonText) {
            return res.status(500).json({ message: 'Gemini API failed to return structured content.' });
        }
        
        // Return the parsed JSON directly to the client
        res.status(200).json(JSON.parse(jsonText));

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ message: 'Internal server error during content generation.' });
    }
};
