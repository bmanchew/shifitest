import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  PlaySquare,
  Pause,
  Headphones,
  Brain,
  Sparkles,
  Volume2,
  MessageSquare,
  BarChart3,
  DollarSign,
  PiggyBank,
  TrendingUp
} from 'lucide-react';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
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
    if (financialData.accounts && financialData.accounts.some((a: any) => a.type === 'savings')) {
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
      const response = await fetch('/api/sesameai/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setIsPlaying(true);
        
        // Play the audio
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.play();
        }
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
          <Avatar className="h-16 w-16 mb-4 bg-indigo-100">
            <AvatarFallback className="text-indigo-600">
              <Bot size={28} />
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
          <Avatar className="h-16 w-16 mb-4 bg-indigo-100">
            <AvatarFallback className="text-indigo-600">
              <Bot size={28} />
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
  
  // Render full insights view
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
            <Avatar className="h-8 w-8 bg-indigo-100">
              <AvatarFallback className="text-indigo-600">
                <Bot size={16} />
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="insights">
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
                        <div className="mr-1 h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying && activeInsightId === insight.id ? (
                        <Pause className="mr-1 h-4 w-4" />
                      ) : (
                        <PlaySquare className="mr-1 h-4 w-4" />
                      )}
                      {isPlaying && activeInsightId === insight.id ? 'Pause' : 'Listen'}
                      <Headphones className="ml-1 h-3 w-3" />
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
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12 text-center">
            <Avatar className="h-16 w-16 mb-4 bg-indigo-100">
              <AvatarFallback className="text-indigo-600">
                <Volume2 size={28} />
              </AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-medium mb-2">Ask Your Financial Sherpa</h3>
            <p className="text-sm text-gray-500 max-w-md mb-6">
              Voice conversation with your AI Financial Sherpa is coming soon. You'll be able to ask questions and get personalized financial guidance through voice interactions.
            </p>
            <Button variant="outline" disabled className="opacity-70">
              <Sparkles className="mr-2 h-4 w-4" />
              Coming Soon
            </Button>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}