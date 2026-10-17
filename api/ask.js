// api/ask.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question } = req.body;

  try {
    // 1. Get textual answer from Google's 100% Free Gemini API
    const geminiUrl = `https://googleapis.com{process.env.GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a talking coconut tree. Answer the following question briefly (1-2 sentences max) and enthusiastically about coconuts. Question: ${question}`
          }]
        }]
      })
    });
    
    const geminiData = await geminiResponse.json();
    
    // Safely extract the text response from Google's data format
    if (!geminiData.candidates || !geminiData.candidates[0].content.parts[0].text) {
      throw new Error("Gemini API error or limit reached.");
    }
    const replyText = geminiData.candidates[0].content.parts[0].text;

    // 2. Send text and your hosted ImgBB image link to D-ID to animate the character
    const didResponse = await fetch('https://d-id.com', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.DID_API_KEY}`, // Handled on Vercel
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        script: { 
          type: 'text', 
          input: replyText, 
          provider: { type: 'microsoft', voice_id: 'en-US-GuyNeural' } 
        },
        source_url: "https://i.ibb.co/hRpqz2BL/lucid-origin-A-2-D-cartoon-style-coconut-tree-character-with-a-friendly-human-face-big-express-0.jpg", 
        config: { 
          fluent: true, 
          face_expressions: [{ time_input: 0, expression: 'happy', intensity: 1 }] 
        }
      })
    });

    const didData = await didResponse.json();
    const talkId = didData.id;

    // 3. Keep checking D-ID until the video generation is processed
    let videoUrl = null;
    let attempts = 0;
    
    while (!videoUrl && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const checkRes = await fetch(`https://d-id.com/${talkId}`, {
        headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}` }
      });
      const checkData = await checkRes.json();
      
      if (checkData.result_url) {
        videoUrl = checkData.result_url;
      }
      attempts++;
    }

    if (!videoUrl) throw new Error("Video generation timed out.");

    res.status(200).json({ text: replyText, videoUrl: videoUrl });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
