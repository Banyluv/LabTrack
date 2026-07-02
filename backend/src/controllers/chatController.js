const askQuestion = async (req, res) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
  }

  try {
    const prompt = `You are an AI assistant for a consumable inventory management system used by facility staff and administrators.
The user may ask about navigation, how to record stock receipts, use daily usage logs, approve requests, or understand batch and expiry reports.
Provide a short, helpful answer and mention relevant pages when appropriate.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: question },
        ],
        temperature: 0.2,
        max_tokens: 450,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Chat assistant error', response.status, errorBody);
      return res.status(500).json({ error: 'Unable to get a response from the AI assistant.' });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    return res.json({ answer: answer || 'I could not generate an answer at this time.' });
  } catch (error) {
    console.error('Chat assistant error', error?.message || error);
    return res.status(500).json({ error: 'Unable to get a response from the AI assistant.' });
  }
};

module.exports = { askQuestion };