import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  PlayCircle, 
  Pause,
  Headphones,
  Brain,
  Sparkles,
  PiggyBank,
  SendHorizonal,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  BarChart3,
  DollarSign,
  TrendingUp,
  Volume2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Define interface for financial insights
interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'investment' | 'debt';
  impact: 'high' | 'medium' | 'low';
  audioUrl?: string;
  actionText?: string;
  actionUrl?: string;
}

// Define message interface for chat
interface SherpaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  mp3Url?: string;
  timestamp: Date;
}

// Define interface for component props
interface AIFinancialSherpaProps {
  customerId: number;
  customerName: string;
  contract?: any;
  financialData?: any;
  isLoading?: boolean;
  hasBankConnection?: boolean;
  onConnectBank?: () => void;
  onRefreshData?: () => void;
}

export default function AIFinancialSherpa({
  customerId,
  customerName,
  contract,
  financialData,
  isLoading = false,
  hasBankConnection = false,
  onConnectBank,
  onRefreshData
}: AIFinancialSherpaProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // State for insights tab
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  // State for conversation tab
  const [messages, setMessages] = useState<SherpaMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hi ${customerName}! I'm your Financial Sherpa. Ask me anything about your finances, and I'll provide personalized guidance based on your financial data.`,
      timestamp: new Date()
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioMessage, setCurrentAudioMessage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<string | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  
  // Sample insights based on financial data
  const getInsights = (): FinancialInsight[] => {
    if (!financialData || !financialData.hasPlaidData) return [];
    
    // This would normally come from the API using actual financial data
    // For now we're using placeholder insights that would be generated
    // server-side from real financial data
    const insights: FinancialInsight[] = [];
    
    // Start with spending patterns if available
    if (financialData.cashFlow && financialData.cashFlow.expenses) {
      const topExpenseCategory = financialData.cashFlow.topExpenseCategory;
      if (topExpenseCategory) {
        insights.push({
          id: 'spending-pattern',
          title: 'Spending Pattern Detected',
          description: `Your highest spending category is ${topExpenseCategory.name}, at ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(topExpenseCategory.amount)} this month. This is ${topExpenseCategory.percentChange > 0 ? 'up' : 'down'} ${Math.abs(topExpenseCategory.percentChange)}% from last month.`,
          category: 'spending',
          impact: 'medium'
        });
      }
    }
    
    // Add savings insights
    if (financialData.accounts && financialData.accounts.accounts && 
        Array.isArray(financialData.accounts.accounts) && 
        financialData.accounts.accounts.some((a: any) => a.type === 'savings')) {
      const savingsRate = financialData.savingsRate || 5;
      const idealRate = 20;
      insights.push({
        id: 'savings-opportunity',
        title: 'Savings Opportunity',
        description: `Your current savings rate is approximately ${savingsRate}% of your income. Financial experts recommend saving at least ${idealRate}% for long-term financial security.`,
        category: 'saving',
        impact: 'high',
        actionText: 'View Savings Plan',
        actionUrl: '/savings-plan'
      });
    }
    
    // Add debt insights if payment data is available
    if (contract && contract.monthlyPayment) {
      insights.push({
        id: 'payment-strategy',
        title: 'Payment Strategy',
        description: `Making your monthly payment of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contract.monthlyPayment)} on time each month will help improve your credit score.`,
        category: 'debt',
        impact: 'high'
      });
    }
    
    // Add investment insight if they have investment accounts
    if (financialData.hasInvestments) {
      insights.push({
        id: 'investment-diversification',
        title: 'Investment Opportunity',
        description: 'Based on your current portfolio, you may benefit from greater diversification. Consider exploring index funds with lower fees to maximize your returns.',
        category: 'investment',
        impact: 'medium',
        actionText: 'Learn More',
        actionUrl: '/investment-education'
      });
    }
    
    // If we have unusual spending patterns
    if (financialData.unusualSpending) {
      insights.push({
        id: 'unusual-spending',
        title: 'Unusual Spending Alert',
        description: `We've detected unusual spending in the ${financialData.unusualSpending.category} category, which is ${financialData.unusualSpending.percentChange}% higher than your usual pattern.`,
        category: 'spending',
        impact: 'high'
      });
    }
    
    return insights;
  };
  
  const insights = getInsights();
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle playing audio for a specific insight
  const playInsightAudio = async (insight: FinancialInsight) => {
    // If already playing this insight, just pause
    if (isPlaying && activeInsightId === insight.id) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    
    setActiveInsightId(insight.id);
    
    // If the insight already has an audio URL, play it
    if (insight.audioUrl) {
      setCurrentAudioUrl(insight.audioUrl);
      setIsPlaying(true);
      audioRef.current?.play();
      return;
    }
    
    // Otherwise, generate audio from SesameAI service
    setLoadingAudio(true);
    
    try {
      // First, get a CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;
      
      // Now make the request with the CSRF token
      const response = await fetch('/api/sesameai/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          text: insight.description,
          speaker: 0, // Female voice
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }
      
      const data = await response.json();
      
      if (data.success && data.audioUrl) {
        // Update insight with generated audio URL
        insight.audioUrl = data.audioUrl;
        setCurrentAudioUrl(data.audioUrl);
        
        // Create a new Audio object to prevent interruption issues
        const newAudio = new Audio(data.audioUrl);
        
        // Set up event listeners on the new audio object
        newAudio.addEventListener('ended', () => {
          setIsPlaying(false);
          setActiveInsightId(null);
        });
        
        // Replace the current audio reference
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = newAudio;
        
        // Play the audio after a short delay to ensure it's loaded
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play()
              .then(() => {
                setIsPlaying(true);
              })
              .catch(error => {
                console.error('Error playing audio:', error);
                setIsPlaying(false);
                toast({
                  title: 'Audio Playback Failed',
                  description: 'There was a problem playing the audio. Please try again.',
                  variant: 'destructive',
                });
              });
          }
        }, 100);
      } else {
        throw new Error(data.error || 'Unknown error generating audio');
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      toast({
        title: 'Audio Generation Failed',
        description: 'We were unable to generate voice narration for this insight.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAudio(false);
    }
  };
  
  // Handle sending a message in conversation tab
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const userMessage: SherpaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsSendingMessage(true);
    
    try {
      // First, get a CSRF token
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;
      
      // Generate a response based on user input and financial data
      // In a real implementation, you would call your backend API here
      // For now, we'll simulate a response
      setTimeout(async () => {
        // Generate mock response based on content
        const userQuestion = userInput.toLowerCase();
        let responseContent = '';
        let generatedActionPlan = null;
        
        if (userQuestion.includes('budget') || userQuestion.includes('spending')) {
          responseContent = `Based on your financial data, I can see that your highest spending categories are entertainment (25%), dining (18%), and transportation (15%). You might want to consider setting a monthly budget for each category to help manage your expenses more effectively.`;
          generatedActionPlan = '1. Set up monthly budget for top spending categories\n2. Reduce entertainment expenses by 10%\n3. Track dining expenses weekly\n4. Consider carpooling to reduce transportation costs';
        } else if (userQuestion.includes('save') || userQuestion.includes('saving')) {
          responseContent = `Great question about saving! Currently, you're saving about ${financialData?.savingsRate || 5}% of your income, which is below the recommended 15-20%. I suggest starting with a goal to save 10% and gradually increasing it. Consider automatic transfers to a high-yield savings account on payday.`;
          generatedActionPlan = '1. Increase savings rate from 5% to 10%\n2. Set up automatic transfers on payday\n3. Open a high-yield savings account\n4. Review and adjust savings plan quarterly';
        } else if (userQuestion.includes('debt') || userQuestion.includes('loan') || userQuestion.includes('payment')) {
          responseContent = `Regarding your current debt situation, you have a loan with a monthly payment of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(contract?.monthlyPayment || 500)}. Making consistent on-time payments will help improve your credit score. Based on your income, this payment represents about 15% of your monthly take-home pay, which is within the recommended range.`;
          generatedActionPlan = '1. Continue making on-time monthly payments\n2. Consider setting up automatic payments\n3. Look into refinancing options if interest rates have decreased\n4. Consider making extra payments when possible to reduce total interest paid';
        } else if (userQuestion.includes('invest') || userQuestion.includes('investment')) {
          responseContent = `For investment advice, I recommend diversifying your portfolio. Based on your risk profile and financial goals, a mix of index funds, bonds, and possibly some individual stocks could be appropriate. Remember that investment involves risk, and it's important to consider your long-term goals and time horizon.`;
          generatedActionPlan = '1. Allocate 60% to broad market index funds\n2. Allocate 30% to bond funds for stability\n3. Consider 10% for individual stocks if comfortable with risk\n4. Set up automatic investment contributions\n5. Review portfolio allocation annually';
        } else {
          responseContent = `Thanks for your question! Based on your financial data, I can see that you have a healthy balance across accounts, though there's always room for optimization. Your contract payments are on track, and your spending patterns show good discipline. Is there a specific area of your finances you'd like me to dive deeper into?`;
        }
        
        const assistantMessage: SherpaMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsSendingMessage(false);
        
        if (generatedActionPlan) {
          setActionPlan(generatedActionPlan);
        }
        
        // Generate audio for the assistant's message
        try {
          // Now make the request with the CSRF token
          const response = await fetch('/api/sesameai/generate-voice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({
              text: responseContent.slice(0, 300), // Limit text length for audio
              speaker: 0, // Female voice
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to generate audio');
          }
          
          const data = await response.json();
          
          if (data.success && (data.audioUrl || data.mp3Url)) {
            // Update message with audio URLs
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessage.id 
                  ? { ...msg, audioUrl: data.audioUrl, mp3Url: data.mp3Url } 
                  : msg
              )
            );
          }
        } catch (error) {
          console.error('Error generating audio:', error);
        }
      }, 1500); // Simulate API delay
    } catch (error) {
      console.error('Error sending message:', error);
      setIsSendingMessage(false);
      toast({
        title: 'Message Failed',
        description: 'There was a problem sending your message. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Play audio for a message in conversation
  const playMessageAudio = async (message: SherpaMessage) => {
    if (!message.audioUrl && !message.mp3Url) {
      toast({
        title: 'Audio Not Available',
        description: 'Voice narration is not available for this message.',
        variant: 'default',
      });
      return;
    }
    
    // If already playing this message, just pause
    if (isPlayingAudio && currentAudioMessage === message.id) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
      setCurrentAudioMessage(null);
      return;
    }
    
    setCurrentAudioMessage(message.id);
    setLoadingAudio(true);
    
    try {
      // Try MP3 first as it has better browser compatibility, fall back to WAV
      const audioUrl = message.mp3Url || message.audioUrl;
      console.log("Attempting to play audio from URL:", audioUrl);
      
      // Add cache-busting parameter to avoid caching issues
      const urlWithCacheBust = `${audioUrl}?t=${Date.now()}`;
      
      // Create a new Audio object to prevent interruption issues
      const newAudio = new Audio(urlWithCacheBust);
      
      // Add error event listener to detect format issues
      newAudio.addEventListener('error', (e) => {
        console.error('Audio loading error:', e);
        console.error('Audio element error code:', newAudio.error?.code);
        console.error('Audio element error message:', newAudio.error?.message);
        
        // If MP3 failed and we have WAV as backup, try that instead
        if (message.mp3Url && message.audioUrl && message.mp3Url !== message.audioUrl) {
          console.log("MP3 failed, trying WAV fallback");
          const wavUrl = `${message.audioUrl}?t=${Date.now()}`;
          const wavAudio = new Audio(wavUrl);
          
          wavAudio.addEventListener('error', (wavError) => {
            console.error('WAV audio loading error:', wavError);
            console.error('WAV audio error code:', wavAudio.error?.code);
            console.error('WAV audio error message:', wavAudio.error?.message);
            setLoadingAudio(false);
            toast({
              title: 'Audio Loading Failed',
              description: `All audio formats failed to load. Please try again later.`,
              variant: 'destructive',
            });
          });
          
          wavAudio.addEventListener('ended', () => {
            setIsPlayingAudio(false);
            setCurrentAudioMessage(null);
            setLoadingAudio(false);
          });
          
          if (audioRef.current) {
            audioRef.current.pause();
          }
          audioRef.current = wavAudio;
          
          wavAudio.play()
            .then(() => {
              setIsPlayingAudio(true);
              setLoadingAudio(false);
            })
            .catch(wavPlayError => {
              console.error('Error playing WAV audio:', wavPlayError);
              setIsPlayingAudio(false);
              setLoadingAudio(false);
              setCurrentAudioMessage(null);
              toast({
                title: 'Audio Playback Failed',
                description: 'All audio formats failed to play. Please try again later.',
                variant: 'destructive',
              });
            });
          return;
        }
        
        setLoadingAudio(false);
        toast({
          title: 'Audio Loading Failed',
          description: `Error loading audio file: ${newAudio.error?.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      });
      
      // Set up event listeners on the new audio object
      newAudio.addEventListener('ended', () => {
        console.log("Audio playback completed");
        setIsPlayingAudio(false);
        setCurrentAudioMessage(null);
        setLoadingAudio(false);
      });
      
      // Add canplaythrough event to ensure the audio is fully loaded before playing
      newAudio.addEventListener('canplaythrough', () => {
        console.log("Audio can play through without buffering");
      });
      
      // Replace the current audio reference
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = newAudio;
      
      // Play the audio
      audioRef.current.play()
        .then(() => {
          console.log("Audio playback started successfully");
          setIsPlayingAudio(true);
          setLoadingAudio(false);
        })
        .catch(error => {
          console.error('Error playing audio:', error);
          setIsPlayingAudio(false);
          setLoadingAudio(false);
          setCurrentAudioMessage(null);
          toast({
            title: 'Audio Playback Failed',
            description: 'There was a problem playing the audio. Please try again.',
            variant: 'destructive',
          });
        });
    } catch (error) {
      console.error('Error playing audio:', error);
      setLoadingAudio(false);
      setCurrentAudioMessage(null);
      toast({
        title: 'Audio Playback Failed',
        description: 'There was a problem playing the audio. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Toggle summary visibility
  const toggleSummary = () => {
    setSummaryVisible(!summaryVisible);
  };

  // Start a voice conversation with the Financial Sherpa
  const startVoiceConversation = async () => {
    if (loadingAudio) return;
    
    setLoadingAudio(true);
    console.log("Starting voice conversation for customer:", customerId);
    
    try {
      // First, get a CSRF token
      console.log("Fetching CSRF token...");
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        console.error("Failed to get CSRF token. Status:", csrfResponse.status);
        throw new Error('Failed to get CSRF token');
      }
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;
      console.log("CSRF token received successfully");
      
      // Make the API call to start a voice conversation
      console.log("Making API call to start conversation...");
      const response = await fetch('/api/financial-sherpa/start-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          customerId,
          speaker: 0, // Female voice
        }),
      });
      
      // Log full error details if the request fails
      if (!response.ok) {
        console.error("Start conversation response not OK. Status:", response.status);
        const errorText = await response.text();
        console.error("Error details:", errorText);
        throw new Error(`Failed to start voice conversation: ${response.status} ${errorText}`);
      }
      
      console.log("Response received, parsing JSON...");
      const data = await response.json();
      console.log("Response data:", data);
      
      if (data.success && data.message) {
        console.log("Successfully started conversation with ID:", data.conversationId);
        // Update conversation
        setMessages([data.message]);
        setConversationId(data.conversationId);
        
        // Play the greeting audio - prefer MP3 for better compatibility
        if (data.message.mp3Url || data.message.audioUrl) {
          // Try MP3 first if available (better browser compatibility)
          const audioToPlay = data.message.mp3Url || data.message.audioUrl;
          console.log("Playing greeting audio from URL:", audioToPlay);
          
          // Use a more robust audio URL that includes a timestamp to avoid caching issues
          const audioUrl = `${audioToPlay}?t=${Date.now()}`;
          console.log("Using audio URL with cache-busting:", audioUrl);
          
          // Create a new Audio object to prevent interruption issues
          const newAudio = new Audio(audioUrl);
          
          // Add error event listener to detect format issues
          newAudio.addEventListener('error', (e) => {
            console.error('Audio loading error:', e);
            console.error('Audio element error code:', newAudio.error?.code);
            console.error('Audio element error message:', newAudio.error?.message);
            
            // If MP3 failed and we have WAV as backup, try that instead
            if (data.message.mp3Url && data.message.audioUrl && data.message.mp3Url !== data.message.audioUrl) {
              console.log("MP3 failed, trying WAV fallback");
              const wavUrl = `${data.message.audioUrl}?t=${Date.now()}`;
              const wavAudio = new Audio(wavUrl);
              
              wavAudio.addEventListener('error', (wavError) => {
                console.error('WAV audio loading error:', wavError);
                console.error('WAV audio error code:', wavAudio.error?.code);
                console.error('WAV audio error message:', wavAudio.error?.message);
                setLoadingAudio(false);
                toast({
                  title: 'Audio Loading Failed',
                  description: `All audio formats failed to load. Please try again later.`,
                  variant: 'destructive',
                });
              });
              
              wavAudio.addEventListener('ended', () => {
                setIsPlayingAudio(false);
                setCurrentAudioMessage(null);
                setLoadingAudio(false);
              });
              
              if (audioRef.current) {
                audioRef.current.pause();
              }
              audioRef.current = wavAudio;
              
              wavAudio.play()
                .then(() => {
                  setIsPlayingAudio(true);
                  setCurrentAudioMessage(data.message.id);
                  setLoadingAudio(false);
                })
                .catch(wavPlayError => {
                  console.error('Error playing WAV audio:', wavPlayError);
                  setIsPlayingAudio(false);
                  setLoadingAudio(false);
                  setCurrentAudioMessage(null);
                  toast({
                    title: 'Audio Playback Failed',
                    description: 'All audio formats failed to play. Please try again later.',
                    variant: 'destructive',
                  });
                });
              return;
            }
            
            setLoadingAudio(false);
            toast({
              title: 'Audio Loading Failed',
              description: `Error loading audio file: ${newAudio.error?.message || 'Unknown error'}`,
              variant: 'destructive',
            });
          });
          
          // Set up event listeners on the new audio object
          newAudio.addEventListener('ended', () => {
            console.log("Audio playback completed");
            setIsPlayingAudio(false);
            setCurrentAudioMessage(null);
            setLoadingAudio(false);
          });
          
          // Add canplaythrough event to ensure the audio is fully loaded before playing
          newAudio.addEventListener('canplaythrough', () => {
            console.log("Audio can play through without buffering");
          });
          
          // Replace the current audio reference
          if (audioRef.current) {
            audioRef.current.pause();
          }
          audioRef.current = newAudio;
          
          // Play the audio
          audioRef.current.play()
            .then(() => {
              console.log("Audio playback started successfully");
              setIsPlayingAudio(true);
              setCurrentAudioMessage(data.message.id);
            })
            .catch(error => {
              console.error('Error playing audio:', error);
              setLoadingAudio(false);
              toast({
                title: 'Audio Playback Failed',
                description: 'There was a problem playing the audio. Please try again.',
                variant: 'destructive',
              });
            });
        } else {
          console.warn("No audio URL provided in the response");
          setLoadingAudio(false);
        }
      } else {
        console.error("API returned success=false or missing message:", data);
        throw new Error(data.error || 'Unknown error starting conversation');
      }
    } catch (error) {
      console.error('Error starting voice conversation:', error);
      setLoadingAudio(false);
      toast({
        title: 'Conversation Failed',
        description: 'We were unable to start a voice conversation. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Handle audio playback events
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setActiveInsightId(null);
    };
    
    audio?.addEventListener('ended', handleEnded);
    
    return () => {
      audio?.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  // Create audio element when component mounts
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Update audio source when currentAudioUrl changes
  useEffect(() => {
    if (audioRef.current && currentAudioUrl) {
      audioRef.current.src = currentAudioUrl;
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      }
    }
  }, [currentAudioUrl, isPlaying]);
  
  // Render loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            AI Financial Sherpa
            <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">
              SesameAI Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <div className="h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="font-medium mb-2">Analyzing Your Financial Profile</h3>
          <p className="text-sm text-gray-500">
            Please wait while our AI analyzes your financial data to provide personalized guidance.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Render bank connection required state
  if (!hasBankConnection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            AI Financial Sherpa
            <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">
              SesameAI Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Avatar className="h-16 w-16 mb-4 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-md">
            <AvatarFallback className="text-white">
              <Bot size={32} strokeWidth={1.25} />
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-medium mb-2">Connect Your Bank Account</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your AI Financial Sherpa needs access to your banking data to provide personalized voice-guided financial insights.
          </p>
          {onConnectBank && (
            <Button onClick={onConnectBank} className="mt-2 bg-indigo-600 hover:bg-indigo-700">
              <PiggyBank className="mr-2 h-4 w-4" />
              Connect Bank Account
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Render insights with no data state
  if (!insights.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            AI Financial Sherpa
            <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">
              SesameAI Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Avatar className="h-16 w-16 mb-4 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-md">
            <AvatarFallback className="text-white">
              <Bot size={32} strokeWidth={1.25} />
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-medium mb-2">Building Your Financial Insights</h3>
          <p className="text-sm text-gray-500 mb-4">
            We're processing your financial data to generate personalized insights with AI-powered voice guidance.
          </p>
          {onRefreshData && (
            <Button variant="outline" onClick={onRefreshData} className="mt-2">
              <Sparkles className="mr-2 h-4 w-4" />
              Refresh Analysis
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Render full component with tabs
  return (
    <Card className="border-indigo-200 shadow-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            AI Financial Sherpa
            <Badge variant="outline" className="ml-2 bg-indigo-100 text-indigo-800 border-indigo-300 text-xs">
              SesameAI Powered
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Avatar className="h-10 w-10 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-sm">
              <AvatarFallback className="text-white">
                <Bot size={20} strokeWidth={1.25} />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="conversation">
        <div className="px-6 pt-2 border-b">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="insights" className="data-[state=active]:bg-indigo-50">
              <Sparkles className="h-4 w-4 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="conversation" className="data-[state=active]:bg-indigo-50">
              <MessageSquare className="h-4 w-4 mr-1" />
              Ask Sherpa
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="insights" className="p-0 m-0">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {insights.map((insight) => (
                <div 
                  key={insight.id}
                  className={`p-4 rounded-lg transition-colors ${activeInsightId === insight.id 
                    ? 'bg-indigo-50 border border-indigo-200' 
                    : 'bg-white border border-gray-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      {insight.category === 'spending' && <BarChart3 className="h-4 w-4 mr-2 text-orange-500" />}
                      {insight.category === 'saving' && <PiggyBank className="h-4 w-4 mr-2 text-green-500" />}
                      {insight.category === 'debt' && <DollarSign className="h-4 w-4 mr-2 text-red-500" />}
                      {insight.category === 'investment' && <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />}
                      <h3 className="font-medium">{insight.title}</h3>
                    </div>
                    <Badge 
                      variant={
                        insight.impact === 'high' ? 'destructive' : 
                        insight.impact === 'medium' ? 'default' : 
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {insight.impact === 'high' ? 'High Impact' : 
                       insight.impact === 'medium' ? 'Medium Impact' : 
                       'Low Impact'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-0 h-8 ${loadingAudio && activeInsightId === insight.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => playInsightAudio(insight)}
                      disabled={loadingAudio && activeInsightId === insight.id}
                    >
                      {loadingAudio && activeInsightId === insight.id ? (
                        <div className="flex-shrink-0 rounded-full w-7 h-7 bg-gradient-to-br from-indigo-200 to-purple-200 shadow-md flex items-center justify-center">
                          <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : isPlaying && activeInsightId === insight.id ? (
                        <div className="flex-shrink-0 rounded-full w-7 h-7 bg-gradient-to-br from-amber-500 to-red-600 shadow-md flex items-center justify-center">
                          <Pause className="h-5 w-5 text-white" strokeWidth={1.5} />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 rounded-full w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md flex items-center justify-center">
                          <PlayCircle className="h-5 w-5 text-white" strokeWidth={1.5} />
                        </div>
                      )}
                      <span className="font-medium">{isPlaying && activeInsightId === insight.id ? 'Pause' : 'Listen'}</span>
                      <Headphones className="ml-1.5 h-4 w-4 text-indigo-600" />
                    </Button>
                    
                    {insight.actionText && insight.actionUrl && (
                      <Button variant="link" className="text-indigo-600 p-0 h-8" asChild>
                        <a href={insight.actionUrl}>{insight.actionText}</a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between border-t pt-4">
            <p className="text-xs text-gray-500">
              Powered by SesameAI voice technology
            </p>
            {onRefreshData && (
              <Button variant="ghost" size="sm" onClick={onRefreshData}>
                <Sparkles className="mr-1 h-3 w-3" />
                Refresh Insights
              </Button>
            )}
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="conversation" className="p-0 m-0">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Avatar className="h-24 w-24 mb-6 bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-indigo-200 shadow-md">
              <AvatarFallback className="text-white">
                <Volume2 size={40} strokeWidth={1.5} />
              </AvatarFallback>
            </Avatar>
            
            <h3 className="text-xl font-medium mb-3">Speak with Your Financial Sherpa</h3>
            
            <p className="text-sm text-gray-500 max-w-md mb-8">
              Press the button below to start a voice conversation with your AI Financial Sherpa and get personalized advice.
            </p>
            
            <Button 
              size="lg" 
              className={`rounded-full w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 p-0 shadow-md hover:shadow-lg transition-all ${loadingAudio ? 'opacity-70 cursor-wait' : ''}`}
              onClick={() => {
                // Trigger the voice interaction with the backend
                startVoiceConversation();
              }}
              disabled={loadingAudio}
            >
              {loadingAudio ? (
                <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PlayCircle size={40} className="text-white" />
              )}
            </Button>
            
            <p className="text-xs text-gray-400 mt-6">
              Powered by SesameAI voice technology
            </p>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}