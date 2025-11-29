import express from 'express';
import OpenAI from 'openai';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// OpenAI Client - the newest OpenAI model is "gpt-5" which was released August 7, 2025
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chatHistories = {};
const userSessions = {};

// Perplexity web search - research on the internet (Chrome browser like search)
async function searchWithPerplexity(query, inputLanguage = 'en') {
  if (!process.env.PERPLEXITY_API_KEY) return null;
  
  try {
    console.log('🔍 Searching web with Perplexity for:', query.substring(0, 50), 'Lang:', inputLanguage);
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: inputLanguage === 'tr' 
              ? 'CEVAPLARINI TÜRKÇEDE VER! Açık, net, kısa ve güncel bilgi sağla. Web araştırması yap. Her zaman TÜRKÇE yazmalısın!'
              : 'Respond in ENGLISH only. Provide current, accurate information from web search. Be concise and clear.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9,
        stream: false,
        return_images: false,
        return_related_questions: false
      })
    });

    if (!response.ok) {
      console.error('❌ Perplexity API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || null;
    if (result) {
      console.log('✅ Web search successful - found answer');
    }
    return result;
  } catch (error) {
    console.error('❌ Web search error:', error.message);
    return null;
  }
}

// Redirect root to ChatGPT page
app.get('/', (req, res) => {
  res.redirect('/chatgpt.html');
});

// Detect user input language
function detectLanguage(text) {
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/g;
  const turkishWords = /\b(ve|bir|bu|var|ben|sen|o|da|mi|mı|mu|mü|ne|nedir|nasıl|hangi|kaç|kim|nerede|ne zaman)\b/gi;
  
  const turkishCharCount = (text.match(turkishChars) || []).length;
  const turkishWordCount = (text.match(turkishWords) || []).length;
  const textLength = text.split(' ').length;
  
  if (turkishCharCount > textLength * 0.1 || turkishWordCount > textLength * 0.2) {
    return 'tr';
  }
  
  return 'en';
}

// Intelligent mock response generator - like ChatGPT (Multi-language)
function generateMockResponse(userMessage, language = 'auto', inputLanguage = 'en') {
  const msg = userMessage.toLowerCase();
  const isTurkish = inputLanguage === 'tr';
  
  // Detect question type
  const isCode = msg.includes('code') || msg.includes('write') || msg.includes('function') || msg.includes('class') || msg.includes('program') || msg.includes('example');
  const isExplain = msg.includes('explain') || msg.includes('what') || msg.includes('how') || msg.includes('why') || msg.includes('describe');
  const isHelp = msg.includes('help') || msg.includes('error') || msg.includes('problem') || msg.includes('issue') || msg.includes('fix') || msg.includes('debug');
  
  const codeLanguageMap = {
    javascript: 'JavaScript',
    python: 'Python',
    typescript: 'TypeScript',
    go: 'Go',
    rust: 'Rust',
    nodejs: 'Node.js',
    java: 'Java',
    cpp: 'C++',
    csharp: 'C#',
    php: 'PHP',
    ruby: 'Ruby'
  };
  
  const lang = codeLanguageMap[language] || 'the requested language';
  
  if (isCode) {
    const codeExamples = {
      javascript: `// JavaScript'te bir örnek:
function example() {
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push(i * 2);
  }
  return data;
}

console.log(example());`,
      python: `# Python'da bir örnek:
def example():
    data = []
    for i in range(10):
        data.append(i * 2)
    return data

print(example())`,
      typescript: `// TypeScript'te bir örnek:
function example(): number[] {
  const data: number[] = [];
  for (let i = 0; i < 10; i++) {
    data.push(i * 2);
  }
  return data;
}

console.log(example());`,
      go: `// Go'da bir örnek:
package main
import "fmt"

func example() []int {
    data := []int{}
    for i := 0; i < 10; i++ {
        data = append(data, i*2)
    }
    return data
}`,
      rust: `// Rust'ta bir örnek:
fn example() -> Vec<i32> {
    let mut data: Vec<i32> = Vec::new();
    for i in 0..10 {
        data.push(i * 2);
    }
    data
}`,
      java: `// Java'da bir örnek:
public static List<Integer> example() {
    List<Integer> data = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
        data.add(i * 2);
    }
    return data;
}`
    };
    
    const baseExample = codeExamples[language] || codeExamples.javascript;
    const langName = isTurkish ? lang : lang;
    const prefix = isTurkish 
      ? `${langName} ile sana yardımcı olmaktan memnunum! İşte pratik bir örnek:\n\n`
      : `I'd be happy to help with ${lang}! Here's a practical example:\n\n`;
    const suffix = isTurkish
      ? `\n\nBu, temel deseni göstermektedir. Bunu özel ihtiyaçlarına göre değiştirebilirsin. Herhangi bir kısmı açıklamam gerekir mi veya bunun uyarlanmasında sana yardımcı olmam gerekir mi?`
      : `\n\nThis demonstrates the basic pattern. You can modify this based on your specific needs. Would you like me to explain any part of this or help you adapt it for a specific use case?`;
    
    return `${prefix}${baseExample}${suffix}`;
  }
  
  if (isHelp) {
    if (isTurkish) {
      return `Bir sorununla karşı karşıya olduğunu anlıyorum. Bunu gidermeye yardımcı olayım:\n\n1. **Sorunu belirle**: Tam olarak ne oluyor? Hata mesajı var mı?\n\n2. **Temelleri kontrol et**:\n   - Sözdizimini (syntax) ve yazımını kontrol et\n   - Tüm import ve bağımlılıkların dahil olduğundan emin ol\n   - Dosya yollarını ve yapılandırmaları kontrol et\n\n3. **Sistematik olarak hata ayıkla**:\n   - Çalıştırmayı izlemek için console log'ları ekle\n   - Kodunun küçük parçalarını ayrı ayrı test et\n   - Ortam değişkenlerini ve ayarlarını kontrol et\n\n4. **Çözüm ara**: Hata mesajlarını internette ara - mevcut çözümleri bulabilirsin\n\nDetayları paylaşabilir misin? Bu bana daha spesifik rehberlik vermeme yardımcı olacak.`;
    }
    return `I understand you're facing an issue. Let me help you troubleshoot this:\n\n1. **Identify the problem**: What exactly is happening when you encounter this? Any error messages?\n\n2. **Check the basics**:\n   - Verify your syntax and spelling\n   - Make sure all imports/dependencies are included\n   - Check your file paths and configurations\n\n3. **Debug systematically**:\n   - Add console logs or print statements to trace execution\n   - Test small parts of your code in isolation\n   - Check your environment variables and settings\n\n4. **Search for solutions**: Search error messages online - you might find existing solutions\n\nCan you share more details about what's happening? That will help me give you more specific guidance.`;
  }
  
  if (isExplain) {
    if (isTurkish) {
      return `Harika bir soru! Bunu parça parça açıklayayım:\n\n**Önemli Noktalar:**\n• Bu kavram, sistemlerin birlikte nasıl çalıştığını anlamakla ilgilidir\n• Birbirini etkileyen birçok önemli bileşeni içerir\n• Her parçayı anlamak bütünü anlamanı yardımcı olur\n\n**Nasıl çalışır:**\n1. Önce temeller - temel bilgileri öğrenmen gerekir\n2. Sonra bu bilgi üstüne kademeli olarak inşa et\n3. Son olarak bu fikirleri karmaşık çözümlere birleştir\n\n**Gerçek Dünya Uygulaması:**\nBu ilke yazılım geliştirme, veri bilimi ve sistem tasarımında çok sayıda alanda geçerlidir.\n\n**Daha Fazla Bilgi:**\n- Temeller ve örneklerle başla\n- Küçük projeler uygulayarak pratik yap\n- Karmaşıklığı kademeli olarak arttır\n- Diğerlerinden öğrenmek için toplulukların katıl\n\nHerhangi bir belirli konuda daha derine inmek ister misin?`;
    }
    return `That's a great question! Let me break this down for you:\n\n**Key Points:**\n• This concept relates to understanding how systems work together\n• It involves several important components that interact\n• Understanding each part helps you grasp the whole picture\n\n**How it works:**\n1. First, the foundation - you need to understand the basics\n2. Then, you build on that knowledge progressively\n3. Finally, you can combine these ideas into complex solutions\n\n**Real-world Application:**\nThis principle applies across many areas in software development, data science, and system design.\n\n**Further Learning:**\n- Start with fundamentals and examples\n- Practice implementing small projects\n- Gradually increase complexity\n- Join communities to learn from others\n\nWould you like me to dive deeper into any specific aspect?`;
  }
  
  // Default thoughtful responses - varied
  const defaultResponses = isTurkish ? [
    `İlginç bir soru! Bunu sistematik olarak düşüneyim:\n\n**Analiz:**\n1. **Bağlam**: Sorun modern uygulamalarla ilgilidir\n2. **Ana Faktörler**: Birden fazla yaklaşım ve değişim vardır\n3. **Uygulama**: Başarı özel ihtiyaçlarını anlamaktan bağlıdır\n\n**Yaklaşım:**\n- Güncel en iyi uygulamaları araştır\n- Kısıtlamalarını ve kaynaklarını düşün\n- Çözümleri kademeli olarak test et\n- Geri bildirim topla ve tekrarla\n\n**Kaynaklar:**\n- Komunite dokümantasyonu\n- Endüstri çalışmaları\n- Pratik deneyim\n- Akran tartışması\n\nHangi belirli konuda daha derine inmek istersin?`,
    
    `Harika soru! İşte benim bakış açım:\n\n**Konuyu Anlamak:**\nBu birbirini etkileyen birkaç kavramı içerir.\n\n**Ana Noktalar:**\n• Birden fazla geçerli yaklaşım vardır\n• Bağlam oldukça önemlidir\n• En iyi uygulamalar zaman içinde gelişir\n• Pratik deneyim değerli dersler öğretir\n\n**Stratejik Adımlar:**\n1. Temelleri anla\n2. Farklı uygulamaları keşfet\n3. Gerçekçi senaryolarda test et\n4. Sonuçlardan öğren\n5. Yaklaşımını geliştir\n\n**Daha Fazla Keşif:**\n- Yetkili kaynakları oku\n- Gerçek dünya örneklerini çalış\n- Uygulamalar yap\n- Uzmanlarla bağlantı kur\n\nHerhangi bir kısım hakkında daha açık bilgi istersin?`,
    
    `Mükemmel soru! Bunu şöyle açıklayayım:\n\n**Geniş Resim:**\nBu konu birden fazla önemli dengeyi içerir.\n\n**Ana Unsurlar:**\n- Teori ve pratik\n- Performans ve bakım yapılabilirlik\n- Güncel standartlar ve gelecek trendleri\n- Senin özel durumun\n\n**Pratik Strateji:**\nTemellerden başla → Seçenekleri keşfet → Yaklaşımları test et → Geri bildirimden öğren → Optimize et\n\n**Önemli Dikkat Edilecekler:**\n✓ Kod kalitesi ve okunabilirliği\n✓ Performans ölçümleri\n✓ Bakım yükü\n✓ Takım uzmanlığı\n✓ Uzun vadeli ölçeklenebilirlik\n\n**Sonraki Adımlar:**\nSenin özel durumun hakkında daha detay ver ve sana hedefli rehberlik verebilirim.`,
  ] : [
    `That's an interesting question! Let me think through this systematically:\n\n**Analysis:**\n1. **Context**: Your question relates to important modern practices\n2. **Key Factors**: Multiple approaches and trade-offs exist\n3. **Implementation**: Success depends on understanding your specific needs\n\n**Approach:**\n- Research current best practices\n- Consider your constraints and resources\n- Test solutions progressively\n- Gather feedback and iterate\n\n**Resources:**\n- Community documentation\n- Industry case studies\n- Hands-on experimentation\n- Peer discussion\n\nWhat specific aspect would you like me to dive deeper into?`,
    
    `Great question! Here's my perspective:\n\n**Understanding the Topic:**\nThis involves several interconnected concepts that work together.\n\n**Key Points:**\n• Multiple valid approaches exist\n• Context matters significantly\n• Best practices evolve over time\n• Practical experience teaches valuable lessons\n\n**Strategic Steps:**\n1. Understand the fundamentals\n2. Explore different implementations\n3. Test in realistic scenarios\n4. Learn from results\n5. Refine your approach\n\n**Further Exploration:**\n- Read authoritative sources\n- Study real-world examples\n- Experiment hands-on\n- Connect with experts\n\nWould you like me to elaborate on any part?`,
    
    `Excellent question! Let me break this down for you:\n\n**The Big Picture:**\nThis topic involves balancing several important considerations.\n\n**Key Elements:**\n- Theory and practice\n- Performance and maintainability\n- Current standards and future trends\n- Your specific use case\n\n**Practical Strategy:**\nStart with foundations → Explore options → Test approaches → Learn from feedback → Optimize\n\n**Important Considerations:**\n✓ Code quality and readability\n✓ Performance metrics\n✓ Maintenance burden\n✓ Team expertise\n✓ Long-term scalability\n\n**Next Steps:**\nShare more details about your specific scenario, and I can provide more targeted guidance.`,
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Get system prompt based on selected language with extended thinking and input language detection
function getSystemPrompt(language, inputLanguage = 'en') {
  const basePrompts = {
    auto: 'You are a world-class AI assistant with exceptional reasoning capabilities. Think deeply about questions before answering. Provide thorough, well-reasoned responses that consider multiple perspectives and edge cases.',
    javascript: 'You are a world-class JavaScript/Node.js expert. Think deeply about problems. Provide expert-level solutions with detailed explanations of design patterns, performance considerations, and best practices.',
    python: 'You are a world-class Python expert. Think deeply about problems. Provide expert-level solutions with explanations of data structures, algorithms, and pythonic patterns.',
    typescript: 'You are a world-class TypeScript expert. Think deeply about problems. Provide expert-level solutions with detailed type system insights and best practices.',
    go: 'You are a world-class Go expert. Think deeply about problems. Provide expert-level solutions focusing on concurrency, efficiency, and Go idioms.',
    rust: 'You are a world-class Rust expert. Think deeply about problems. Provide expert-level solutions with detailed explanations of ownership, borrowing, and performance optimization.',
    nodejs: 'You are a world-class Node.js expert. Think deeply about problems. Provide expert-level solutions with explanations of async patterns, streams, and production best practices.',
    java: 'You are a world-class Java expert. Think deeply about problems. Provide expert-level solutions with OOP principles and enterprise patterns.',
    cpp: 'You are a world-class C++ expert. Think deeply about problems. Provide expert-level solutions with memory management, STL, and performance optimization.',
    csharp: 'You are a world-class C# expert. Think deeply about problems. Provide expert-level solutions with LINQ, async/await, and .NET patterns.',
    php: 'You are a world-class PHP expert. Think deeply about problems. Provide expert-level solutions with modern PHP practices and architecture.',
    ruby: 'You are a world-class Ruby expert. Think deeply about problems. Provide expert-level solutions with idiomatic Ruby and Rails patterns.'
  };
  
  const basePrompt = basePrompts[language] || basePrompts.auto;
  
  const languageInstruction = inputLanguage === 'tr' 
    ? `MUTLAKA TÜRKÇE YAZMALIŞIN! ÖNEMLİ: Her cevabı tamamen TÜRKÇE olarak ver. Hiçbir İngilizce kelime kullanma. Cevaplarını açık, profesyonel ve anlaşılır TÜRKÇE ile ver.

Sorunları çözerken:
1. Sorunu sistematik olarak düşün
2. Birden fazla yaklaşımı ve dengelerini düşün
3. Mantığını açıkça açıkla
4. Üretime hazır çözümler sun
5. İlgili bağlam ve en iyi uygulamaları dahil et
6. Gerekirse açıklayıcı sorular sor`
    : `IMPORTANT: Respond in ENGLISH ONLY. Use clear, professional language.

When solving problems:
1. Think through the problem systematically
2. Consider multiple approaches and their tradeoffs
3. Explain your reasoning clearly
4. Provide production-ready solutions
5. Include relevant context and best practices
6. Ask clarifying questions if needed`;
  
  return `${basePrompt}

${languageInstruction}`;
}


// Streaming Chat API Endpoint (SSE) - Try Perplexity first for web search
app.post('/api/chat/stream', async (req, res) => {
  const { message, username, language } = req.body;
  if (!message || !username) return res.status(400).json({ error: 'Message required' });
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const inputLanguage = detectLanguage(message);
    
    if (!chatHistories[username]) {
      chatHistories[username] = [];
    }
    
    chatHistories[username].push({ role: 'user', content: message });
    if (chatHistories[username].length > 100) {
      chatHistories[username] = chatHistories[username].slice(-100);
    }
    
    // OpenAI for intelligent responses
    if (!process.env.OPENAI_API_KEY) {
      const mockResp = generateMockResponse(message, language, inputLanguage);
      chatHistories[username].push({ role: 'assistant', content: mockResp });
      res.write(`data: ${JSON.stringify({ text: mockResp, done: true })}\n\n`);
      return res.end();
    }
    
    const messagesWithSystem = [
      { role: 'system', content: getSystemPrompt(language || 'auto', inputLanguage) },
      ...chatHistories[username]
    ];
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: messagesWithSystem,
      max_completion_tokens: 4096,
      temperature: 0.7,
      stream: true
    });

    fullResponse = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ text: text, done: false })}\n\n`);
      }
    }
    
    chatHistories[username].push({ role: 'assistant', content: fullResponse });
    res.write(`data: ${JSON.stringify({ text: '', done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream Error:', error.message);
    if (error.status === 429 || error.message.includes('quota')) {
      const inputLang = detectLanguage(req.body.message);
      const mockResp = generateMockResponse(req.body.message, req.body.language, inputLang);
      chatHistories[req.body.username]?.push({ role: 'assistant', content: mockResp });
      res.write(`data: ${JSON.stringify({ text: mockResp, done: true, demo: true })}\n\n`);
    }
    res.end();
  }
});

// Non-streaming Chat API Endpoint (fallback)
app.post('/api/chat', async (req, res) => {
  const { message, username, language } = req.body;
  if (!message || !username) return res.status(400).json({ error: 'Mesaj gerekli' });
  
  try {
    const inputLanguage = detectLanguage(message);
    
    // Initialize chat history for user
    if (!chatHistories[username]) {
      chatHistories[username] = [];
    }
    
    // Add user message to history
    chatHistories[username].push({ role: 'user', content: message });
    
    // Keep extended conversation history (up to 100 messages for deeper context)
    if (chatHistories[username].length > 100) {
      chatHistories[username] = chatHistories[username].slice(-100);
    }
    
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      const mockResp = generateMockResponse(message, language, inputLanguage);
      chatHistories[username].push({ role: 'assistant', content: mockResp });
      return res.json({ response: mockResp, demo: true });
    }
    
    try {
      // Call OpenAI - the newest OpenAI model is "gpt-5" which was released August 7, 2025
      const messagesWithSystem = [
        { role: 'system', content: getSystemPrompt(language || 'auto', inputLanguage) },
        ...chatHistories[username]
      ];
      
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: messagesWithSystem,
        max_completion_tokens: 4096,
        temperature: 0.7
      });
      
      const assistantMessage = response.choices[0].message.content;
      chatHistories[username].push({ role: 'assistant', content: assistantMessage });
      
      res.json({ response: assistantMessage });
    } catch (apiError) {
      // Handle quota, rate limit, and other API errors
      console.error('OpenAI API Hatası:', apiError.status, apiError.message);
      
      if (apiError.status === 429 || apiError.message.includes('quota')) {
        // Quota exceeded - use fallback
        const inputLang = detectLanguage(message);
        const mockResp = generateMockResponse(message, language, inputLang);
        chatHistories[username].push({ role: 'assistant', content: mockResp });
        return res.json({ response: mockResp, demo: true, notice: 'Demo Mode: OpenAI quota aşıldı.' });
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Chat Hata:', error.message);
    
    // Last resort: generate mock response
    const inputLang = detectLanguage(req.body.message);
    const mockResp = generateMockResponse(req.body.message, language, inputLang);
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

// Export chat history
app.post('/api/chat/export', (req, res) => {
  const { username, format } = req.body;
  if (!username || !chatHistories[username]) return res.status(400).json({ error: 'No chat found' });
  
  const messages = chatHistories[username];
  let content = '';
  
  if (format === 'json') {
    content = JSON.stringify(messages, null, 2);
    res.setHeader('Content-Type', 'application/json');
  } else if (format === 'markdown') {
    messages.forEach(msg => {
      content += `**${msg.role === 'user' ? 'You' : 'AI'}:** ${msg.content}\n\n`;
    });
    res.setHeader('Content-Type', 'text/markdown');
  } else {
    messages.forEach(msg => {
      content += `${msg.role === 'user' ? 'You' : 'AI'}:\n${msg.content}\n\n---\n\n`;
    });
    res.setHeader('Content-Type', 'text/plain');
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="chat-${Date.now()}.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}"`);
  res.send(content);
});

// Start
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Chat Server ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
  console.log(`💬 ChatGPT Clone - Soru sorarak başlayın!`);
});
