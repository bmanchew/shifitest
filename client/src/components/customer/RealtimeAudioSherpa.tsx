/**
 * RealtimeAudioSherpa Component
 * 
 * This component provides a real-time voice interface for the Financial Sherpa
 * using OpenAI's Realtime API for real-time audio conversations.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Loader2, Mic, MicOff, Volume2, VolumeX, Info, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

// The possible states of the conversation
type ConversationState = 
  | 'idle'           // No active conversation
  | 'connecting'     // Establishing connection
  | 'connected'      // Connection established but not recording
  | 'recording'      // Actively recording audio
  | 'thinking'       // AI is processing and generating a response
  | 'responding'     // AI is responding (possibly with audio)
  | 'error';         // An error has occurred

// Interface for a message in the conversation
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  audioUrl?: string; // URL to the audio file, if available
}

interface RealtimeAudioSherpaProps {
  customerId?: number;
  customerName?: string;
  financialData?: any;
}

const RealtimeAudioSherpa: React.FC<RealtimeAudioSherpaProps> = ({
  customerId,
  customerName = 'Customer',
  financialData
}) => {
  // State
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [loadingText, setLoadingText] = useState<string>('Connecting...');
  const [connected, setConnected] = useState(false);

  // Refs
  const webSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioOutputRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Toast hook for notifications
  const { toast } = useToast();

  // Effect for automatically scrolling to the bottom of the messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Auto-start conversation when component mounts
  useEffect(() => {
    if (conversationState === 'idle') {
      startConversation();
      
      // Pre-initialize audio recording to prompt for microphone permission right away
      initializeAudioRecording().then(initialized => {
        console.log('Microphone initialized on component mount:', initialized);
      }).catch(error => {
        console.error('Error initializing microphone on mount:', error);
      });
    }
    
    // Cleanup function to end conversation when component unmounts
    return () => {
      if (conversationState !== 'idle') {
        endConversation();
      }
    };
  }, []);

  // Initialize WebSocket connection
  const initializeWebSocket = () => {
    setConversationState('connecting');
    setLoadingText('Connecting to AI...');
    
    // Determine the WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/openai/realtime`;
    
    // Create WebSocket
    const socket = new WebSocket(wsUrl);
    webSocketRef.current = socket;

    // Set up event handlers
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setConnected(true);
      
      // Request a new session
      socket.send(JSON.stringify({
        type: 'create_session',
        voice: 'nova', // Use 'nova' voice for Financial Sherpa
        instructions: `You are the Financial Sherpa, a friendly and knowledgeable AI assistant for ShiFi Financial. Your role is to help ${customerName} understand their financial data, provide insights on their contracts, and answer questions about financial products and services. Keep your responses friendly, concise, and professional. ${
          financialData ? 'Use the financial data available to provide personalized insights.' : 'Encourage connecting bank accounts to provide more personalized insights.'
        }`
      }));
    };

    socket.onmessage = handleWebSocketMessage;

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConversationState('error');
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to the audio service. Please try again later.',
        variant: 'destructive'
      });
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      setConnected(false);
      setSessionId(null);
      if (conversationState !== 'error') {
        setConversationState('idle');
      }
    };
  };

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'welcome':
          console.log('Connected to WebSocket server:', data);
          break;
        
        case 'session_created':
          console.log('Session created:', data);
          setSessionId(data.sessionId);
          setConversationState('connected');
          
          // Add system welcome message
          addMessage({
            id: `system-${Date.now()}`,
            role: 'system',
            content: `Welcome to Financial Sherpa, ${customerName}. You can now speak with me by pressing and holding the microphone button. How can I help you today?`,
            timestamp: Date.now()
          });
          break;

        case 'transcription':
          console.log('Transcription received:', data);
          setTranscription(data.text);
          break;

        case 'message':
          if (data.role === 'assistant') {
            console.log('Assistant message received:', data);
            setConversationState('responding');
            
            // Add assistant message
            addMessage({
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: data.content,
              timestamp: Date.now()
            });
            
            // When message is done, go back to connected state
            setConversationState('connected');
          }
          break;

        case 'audio':
          if (audioEnabled) {
            console.log('Audio data received');
            playAudio(data.audio);
          }
          break;

        case 'error':
          console.error('Error from server:', data);
          toast({
            title: 'Error',
            description: data.message || 'An error occurred',
            variant: 'destructive'
          });
          break;

        case 'session_ended':
          console.log('Session ended:', data);
          setSessionId(null);
          setConversationState('idle');
          break;

        default:
          console.log('Unknown message type:', data);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };

  // Add a message to the conversation
  const addMessage = (message: Message) => {
    setMessages(prevMessages => [...prevMessages, message]);
  };

  // Initialize audio recording
  const initializeAudioRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      
      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        // Process recorded audio
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            
            if (base64Audio && webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              // Send audio data to server
              webSocketRef.current.send(JSON.stringify({
                type: 'audio_data',
                audio: base64Audio
              }));
              
              setConversationState('thinking');
              setLoadingText('Transcribing...');
            }
          };
          reader.readAsDataURL(audioBlob);

          // Add user message when transcription is available
          if (transcription) {
            addMessage({
              id: `user-${Date.now()}`,
              role: 'user',
              content: transcription,
              timestamp: Date.now()
            });
            setTranscription('');
          }
        }
      };

      return true;
    } catch (error) {
      console.error('Error initializing audio recording:', error);
      toast({
        title: 'Microphone Access Error',
        description: 'Please allow microphone access to use the voice feature.',
        variant: 'destructive'
      });
      return false;
    }
  };

  // Start recording audio
  const startRecording = async () => {
    if (conversationState !== 'connected' || !webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Initialize audio recording if not already done
    if (!mediaRecorderRef.current) {
      const initialized = await initializeAudioRecording();
      if (!initialized) return;
    }

    // Start recording
    if (mediaRecorderRef.current) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setRecording(true);
      setConversationState('recording');
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // Play audio from base64
  const playAudio = (base64Audio: string) => {
    if (!audioEnabled) return;

    try {
      // Create AudioContext if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Convert base64 to array buffer
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio element
      const audio = new Audio();
      audio.src = URL.createObjectURL(new Blob([bytes.buffer], { type: 'audio/wav' }));
      audio.play();
      audioOutputRef.current = audio;
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  // Toggle audio output
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  // Start a conversation
  const startConversation = () => {
    if (conversationState === 'idle') {
      // Clear previous conversation
      setMessages([]);
      
      // Initialize WebSocket
      initializeWebSocket();
    }
  };

  // End the conversation
  const endConversation = () => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify({
        type: 'end_session'
      }));
    }
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      // Release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    
    setRecording(false);
    setConversationState('idle');
    setSessionId(null);
  };

  // Render loading state
  const renderLoadingState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-center text-muted-foreground">{loadingText}</p>
      </div>
    );
  };

  // Render status badge
  const renderStatusBadge = () => {
    switch (conversationState) {
      case 'idle':
        return <Badge variant="outline">Disconnected</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Connecting...</Badge>;
      case 'connected':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Ready</Badge>;
      case 'recording':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Recording</Badge>;
      case 'thinking':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Thinking...</Badge>;
      case 'responding':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Responding</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        {conversationState === 'idle' ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Button 
              onClick={startConversation} 
              className="h-32 w-32 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300 mb-6 flex items-center justify-center"
              size="lg"
            >
              <Volume2 className="h-16 w-16 text-white" />
            </Button>
            <h3 className="text-xl font-semibold mb-2">Ask Financial Sherpa</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Click to start your AI financial assistant
            </p>
          </div>
        ) : conversationState === 'connecting' ? (
          renderLoadingState()
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10 bg-primary">
                  <Volume2 className="h-6 w-6 text-primary-foreground" />
                </Avatar>
                <div>
                  <h3 className="font-medium">Financial Sherpa</h3>
                  <p className="text-sm text-muted-foreground">AI Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge()}
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleAudio}
                  title={audioEnabled ? "Mute audio" : "Unmute audio"}
                >
                  {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            
            {/* Messages display */}
            <ScrollArea className="h-[350px] mb-6">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg p-3 max-w-[80%] ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'system'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-secondary text-secondary-foreground'
                    }`}>
                      <p>{message.content}</p>
                      {message.audioUrl && (
                        <audio 
                          controls 
                          src={message.audioUrl} 
                          className="mt-2 w-full max-w-xs"
                          controlsList="nodownload"
                        ></audio>
                      )}
                    </div>
                  </div>
                ))}
                {transcription && (
                  <div className="flex justify-end">
                    <div className="rounded-lg p-3 max-w-[80%] bg-primary text-primary-foreground opacity-70">
                      <p>{transcription} ...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="flex justify-center items-center gap-4">
              {conversationState === 'thinking' || conversationState === 'responding' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-full px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{conversationState === 'thinking' ? 'Processing...' : 'Responding...'}</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={endConversation}
                    disabled={conversationState === 'thinking' || conversationState === 'responding'}
                    className="rounded-full"
                  >
                    End Conversation
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="default"
                    className={`rounded-full h-16 w-16 ${recording ? 'bg-red-500 hover:bg-red-600 scale-110' : 'bg-gradient-to-r from-indigo-500 to-purple-600'} shadow-md transition-all duration-200`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={
                      conversationState === 'connecting' || 
                      conversationState === 'thinking' || 
                      conversationState === 'responding' ||
                      conversationState === 'error'
                    }
                  >
                    {recording ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeAudioSherpa;