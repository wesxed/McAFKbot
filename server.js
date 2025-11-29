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

// Intelligent mock response generator - like ChatGPT (English only)
function generateMockResponse(userMessage, language = 'auto') {
  const msg = userMessage.toLowerCase();
  
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
      javascript: `// Here's an example in JavaScript:
function example() {
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push(i * 2);
  }
  return data;
}

console.log(example());`,
      python: `# Here's an example in Python:
def example():
    data = []
    for i in range(10):
        data.append(i * 2)
    return data

print(example())`,
      typescript: `// Here's an example in TypeScript:
function example(): number[] {
  const data: number[] = [];
  for (let i = 0; i < 10; i++) {
    data.push(i * 2);
  }
  return data;
}

console.log(example());`,
      go: `// Here's an example in Go:
package main
import "fmt"

func example() []int {
    data := []int{}
    for i := 0; i < 10; i++ {
        data = append(data, i*2)
    }
    return data
}`,
      rust: `// Here's an example in Rust:
fn example() -> Vec<i32> {
    let mut data: Vec<i32> = Vec::new();
    for i in 0..10 {
        data.push(i * 2);
    }
    data
}`,
      java: `// Here's an example in Java:
public static List<Integer> example() {
    List<Integer> data = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
        data.add(i * 2);
    }
    return data;
}`
    };
    
    const baseExample = codeExamples[language] || codeExamples.javascript;
    
    return `I'd be happy to help with ${lang}! Here's a practical example:\n\n${baseExample}\n\nThis demonstrates the basic pattern. You can modify this based on your specific needs. Would you like me to explain any part of this or help you adapt it for a specific use case?`;
  }
  
  if (isHelp) {
    return `I understand you're facing an issue. Let me help you troubleshoot this:\n\n1. **Identify the problem**: What exactly is happening when you encounter this? Any error messages?\n\n2. **Check the basics**:\n   - Verify your syntax and spelling\n   - Make sure all imports/dependencies are included\n   - Check your file paths and configurations\n\n3. **Debug systematically**:\n   - Add console logs or print statements to trace execution\n   - Test small parts of your code in isolation\n   - Check your environment variables and settings\n\n4. **Search for solutions**: Search error messages online - you might find existing solutions\n\nCan you share more details about what's happening? That will help me give you more specific guidance.`;
  }
  
  if (isExplain) {
    return `That's a great question! Let me break this down for you:\n\n**Key Points:**\n• This concept relates to understanding how systems work together\n• It involves several important components that interact\n• Understanding each part helps you grasp the whole picture\n\n**How it works:**\n1. First, the foundation - you need to understand the basics\n2. Then, you build on that knowledge progressively\n3. Finally, you can combine these ideas into complex solutions\n\n**Real-world Application:**\nThis principle applies across many areas in software development, data science, and system design.\n\n**Further Learning:**\n- Start with fundamentals and examples\n- Practice implementing small projects\n- Gradually increase complexity\n- Join communities to learn from others\n\nWould you like me to dive deeper into any specific aspect?`;
  }
  
  // Default thoughtful response
  return `Thank you for your question! Here's my analysis:\n\n**Understanding Your Question:**\nYour question touches on an important aspect of modern software development and technology.\n\n**Key Insights:**\n1. **Current State**: This area is rapidly evolving with many new tools and approaches emerging\n2. **Best Practices**: The most effective solutions combine multiple techniques and perspectives\n3. **Practical Application**: Real-world implementation requires consideration of various factors\n\n**Main Considerations:**\n- Performance and efficiency\n- Code maintainability and readability\n- Scalability for future growth\n- Team collaboration and knowledge sharing\n- Testing and quality assurance\n\n**Recommendations:**\n- Start with solid fundamentals\n- Experiment with different approaches\n- Learn from community best practices\n- Build projects to gain hands-on experience\n- Stay updated with industry trends\n\n**Next Steps:**\nCould you provide more context about what you're trying to achieve? This will help me give more specific guidance tailored to your needs.`;
}

// Get system prompt based on selected language with extended thinking
function getSystemPrompt(language) {
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
  
  return `${basePrompt}

IMPORTANT: Always respond in English only. Use clear, professional language.

When solving problems:
1. Think through the problem systematically
2. Consider multiple approaches and their tradeoffs
3. Explain your reasoning clearly
4. Provide production-ready solutions
5. Include relevant context and best practices
6. Ask clarifying questions if needed`;
}


// AI Chat API Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, username, language } = req.body;
  if (!message || !username) return res.status(400).json({ error: 'Mesaj gerekli' });
  
  try {
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
      const mockResp = generateMockResponse(message, language);
      chatHistories[username].push({ role: 'assistant', content: mockResp });
      return res.json({ response: mockResp, demo: true });
    }
    
    try {
      // Call OpenAI - the newest OpenAI model is "gpt-5" which was released August 7, 2025
      const messagesWithSystem = [
        { role: 'system', content: getSystemPrompt(language || 'auto') },
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
        const mockResp = generateMockResponse(message, language);
        chatHistories[username].push({ role: 'assistant', content: mockResp });
        return res.json({ response: mockResp, demo: true, notice: 'Demo Mode: OpenAI quota aşıldı.' });
      }
      
      throw apiError;
    }
  } catch (error) {
    console.error('Chat Hata:', error.message);
    
    // Last resort: generate mock response
    const mockResp = generateMockResponse(req.body.message, language);
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
