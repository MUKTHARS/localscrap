import React, { useState, useRef, useEffect } from 'react';
import '../../styles/ChatWidget.css';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hello! I can check live prices or analyze your past searches. How can I help?", isBot: true }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput("");
    
    setMessages(prev => [...prev, { text: userMsg, isBot: false }]);
    setIsLoading(true);

    try {
      setMessages(prev => [...prev, { text: "", isBot: true }]);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMsg }),
        credentials: 'include' 
      });

      if (!response.body) throw new Error("ReadableStream not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setIsLoading(false); 

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const textChunk = decoder.decode(value, { stream: true });

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsgIndex = newMessages.length - 1;
          
          const updatedLastMsg = {
            ...newMessages[lastMsgIndex],
            text: newMessages[lastMsgIndex].text + textChunk
          };
          
          newMessages[lastMsgIndex] = updatedLastMsg;
          return newMessages;
        });
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].isBot) {
            newMessages[newMessages.length - 1].text = "Sorry, I lost connection to the server.";
            return newMessages;
        }
        return [...prev, { text: "Sorry, I encountered an error.", isBot: true }];
      });
      setIsLoading(false);
    }
  };

  return (
    <div className={`chat-widget-wrapper ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="chat-launcher" onClick={() => setIsOpen(true)}>
          <i className="bi bi-stars"></i>
          <span>AI Assistant</span>
        </button>
      )}

      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="header-info">
              <i className="bi bi-robot"></i>
              <span>TutoMart AI</span>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <i className="bi bi-chevron-down"></i>
            </button>
          </div>

          <div className="chat-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble ${msg.isBot ? 'bot' : 'user'}`}>
                {msg.text}
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-bubble bot loading">
                <div className="dot"></div><div className="dot"></div><div className="dot"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-footer" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Ask about prices..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" disabled={!input.trim() || isLoading}>
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
