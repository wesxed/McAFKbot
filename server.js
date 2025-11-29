import express from 'express';
import OpenAI from 'openai';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// OpenAI Client - the newest OpenAI model is "gpt-5" which was released August 7, 2025
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chatHistories = {};

// Redirect root to ChatGPT page
app.get('/', (req, res) => {
  res.redirect('/chatgpt.html');
});

// Mock response for demo/testing
function generateMockResponse(userMessage) {
  const responses = [
    `"${userMessage}" iyi bir soru. Bu konuda şu bilgileri söyleyebilirim: AI teknolojisi hızla gelişiyor ve uygulamaları çok geniş.`,
    `${userMessage} hakkında düşündüğümüzde, bunun birçok yönü var. Detaylar şöyle açıklanabilir: Modern teknoloji her gün yenileniyor.`,
    `Sordığunuz "${userMessage}" sorusuna yanıt olarak: Yapay zeka, makine öğrenmesi ve derin öğrenme en popüler alanlardır.`,
    `"${userMessage}" konusunda söyleyeceklerim: Web uygulamaları, mobil uygulamalar ve API'ler günümüzün temel bileşenleridir.`,
    `Harika bir soru: ${userMessage}. Bunu düşünürsek, JavaScript, Python ve TypeScript en çok kullanılan dillerdir.`,
    `${userMessage} ile ilgili olarak: Yazılım geliştirme, veri analizi ve bulut hesaplama önemli becerilerdir.`,
    `"${userMessage}" açısından: Replit, Vercel, Netlify gibi platformlar modern geliştirmeyi kolaylaştırıyor.`
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// AI Chat API Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, username } = req.body;
  if (!message || !username) return res.status(400).json({ error: 'Mesaj gerekli' });
  
  try {
    // Initialize chat history for user
    if (!chatHistories[username]) {
      chatHistories[username] = [];
    }
    
    // Add user message to history
    chatHistories[username].push({ role: 'user', content: message });
    
    // Keep only last 20 messages for context
    if (chatHistories[username].length > 20) {
      chatHistories[username] = chatHistories[username].slice(-20);
    }
    
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      const mockResp = generateMockResponse(message);
      chatHistories[username].push({ role: 'assistant', content: mockResp });
      return res.json({ response: mockResp, demo: true });
    }
    
    try {
      // Call OpenAI - the newest OpenAI model is "gpt-5" which was released August 7, 2025
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: chatHistories[username],
        max_completion_tokens: 1024
      });
      
      const assistantMessage = response.choices[0].message.content;
      chatHistories[username].push({ role: 'assistant', content: assistantMessage });
      
      res.json({ response: assistantMessage });
    } catch (apiError) {
      // Handle quota, rate limit, and other API errors
      console.error('OpenAI API Hatası:', apiError.status, apiError.message);
      
      if (apiError.status === 429 || apiError.message.includes('quota')) {
        // Quota exceeded - use fallback
        const mockResp = generateMockResponse(message);
        chatHistories[username].push({ role: 'assistant', content: mockResp });
        return res.json({ response: mockResp, demo: true, notice: 'Demo Mode: OpenAI quota aşıldı.' });
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Chat Hata:', error.message);
    
    // Last resort: generate mock response
    const mockResp = generateMockResponse(req.body.message);
    const chat = chatHistories[username];
    if (chat) {
      chat.push({ role: 'assistant', content: mockResp });
    }
    
    res.json({ response: mockResp, demo: true, notice: 'Demo Mode: Teknik hata oluştu.' });
  }
});

// Clear chat history
app.post('/api/chat/clear', (req, res) => {
  const { username } = req.body;
  if (username) delete chatHistories[username];
  res.json({ success: true });
});

// Start
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Chat Server ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
  console.log(`💬 ChatGPT Clone - Soru sorarak başlayın!`);
});
