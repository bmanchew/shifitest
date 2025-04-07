import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ticketPriorityEnum, ticketCategoryEnum } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

export type AICategorization = {
  category: string | null;
  priority: string | null;
  confidence: {
    category: number;
    priority: number;
  };
  explanation: string | null;
  tags?: string[];
};

interface TicketCategorizationSuggestionProps {
  subject: string;
  description: string;
  onSelectCategory: (category: string) => void;
  onSelectPriority: (priority: string) => void;
  enabled?: boolean;
}

export function TicketCategorizationSuggestion({
  subject,
  description,
  onSelectCategory,
  onSelectPriority,
  enabled = true
}: TicketCategorizationSuggestionProps) {
  const [suggestion, setSuggestion] = useState<AICategorization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSubject, setDebouncedSubject] = useState(subject);
  const [debouncedDescription, setDebouncedDescription] = useState(description);

  // Debounce inputs to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubject(subject);
      setDebouncedDescription(description);
    }, 600);

    return () => clearTimeout(timer);
  }, [subject, description]);

  // Fetch suggestions when inputs change
  useEffect(() => {
    if (!enabled) return;
    
    async function fetchSuggestions() {
      // Only fetch if we have enough content
      if (debouncedSubject.length < 5 || debouncedDescription.length < 10) {
        setSuggestion(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest<AICategorization>({
          url: '/api/ticket-categorization/suggest',
          method: 'POST',
          data: {
            subject: debouncedSubject,
            description: debouncedDescription
          }
        });
        
        setSuggestion(response);
      } catch (err) {
        console.error('Error fetching AI categorization:', err);
        setError('Failed to get AI suggestions. Please categorize manually.');
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, [debouncedSubject, debouncedDescription, enabled]);

  const renderConfidenceBadge = (confidence: number) => {
    let color = 'bg-gray-100 text-gray-800';
    if (confidence >= 0.9) {
      color = 'bg-green-100 text-green-800';
    } else if (confidence >= 0.7) {
      color = 'bg-yellow-100 text-yellow-800';
    } else if (confidence >= 0.5) {
      color = 'bg-orange-100 text-orange-800';
    } else {
      color = 'bg-red-100 text-red-800';
    }

    return (
      <Badge variant="outline" className={color}>
        {Math.round(confidence * 100)}% confident
      </Badge>
    );
  };

  if (!enabled) return null;
  if (loading && !suggestion) {
    return (
      <div className="flex items-center text-sm text-muted-foreground mt-2">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Analyzing ticket content...
      </div>
    );
  }
  if (error) {
    return <div className="text-sm text-muted-foreground mt-2">{error}</div>;
  }
  if (!suggestion) return null;
  if (!suggestion.category && !suggestion.priority) return null;

  return (
    <Card className="mt-4 border border-dashed border-primary/50">
      <CardContent className="p-4">
        <div className="flex items-center mb-2">
          <Sparkles className="h-4 w-4 text-primary mr-2" />
          <span className="text-sm font-medium">AI Suggestions</span>
        </div>
        
        <div className="space-y-3">
          {suggestion.category && (
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium">Category</div>
                <div className="flex items-center mt-1">
                  <span className="text-sm">{suggestion.category}</span>
                  <span className="ml-2">{renderConfidenceBadge(suggestion.confidence.category)}</span>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectCategory(suggestion.category as string)}
                    >
                      Apply
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Use this suggested category</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          
          {suggestion.priority && (
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium">Priority</div>
                <div className="flex items-center mt-1">
                  <span className="text-sm">{suggestion.priority}</span>
                  <span className="ml-2">{renderConfidenceBadge(suggestion.confidence.priority)}</span>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectPriority(suggestion.priority as string)}
                    >
                      Apply
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Use this suggested priority</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          
          {suggestion.explanation && (
            <div className="mt-2">
              <div className="text-sm font-medium">Reasoning</div>
              <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
            </div>
          )}
          
          {suggestion.tags && suggestion.tags.length > 0 && (
            <div className="mt-2">
              <div className="text-sm font-medium">Suggested Tags</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestion.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}