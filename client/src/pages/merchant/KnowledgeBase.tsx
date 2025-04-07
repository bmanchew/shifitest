import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  categoryId: number;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  isPublished: boolean;
  slug: string;
  metaDescription?: string;
}

interface KnowledgeCategory {
  id: number;
  name: string;
  description?: string;
  slug: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeTag {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface FeedbackStats {
  helpful: number;
  notHelpful: number;
}

interface ArticleResponse {
  article: KnowledgeArticle;
  tags: KnowledgeTag[];
  feedbackStats: FeedbackStats;
}

const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch all articles
  const { data: articlesData, isLoading: isLoadingArticles } = useQuery({
    queryKey: ['/api/knowledge-base/articles'],
    retry: 1
  });

  // Fetch all categories
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/knowledge-base/categories'],
    retry: 1
  });

  // Fetch selected article details
  const { data: articleData, isLoading: isLoadingArticle } = useQuery({
    queryKey: ['/api/knowledge-base/articles', selectedArticleId],
    enabled: !!selectedArticleId,
    retry: 1
  });

  // Fetch search results when search query changes
  const { data: searchData, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['/api/knowledge-base/search', { query: searchQuery }],
    enabled: searchQuery.length > 2,
    retry: 1
  });

  const articles = articlesData?.success ? articlesData.articles : [];
  const categories = categoriesData?.success ? categoriesData.categories : [];
  const searchResults = searchData?.success ? searchData.articles : [];
  const article = articleData?.success ? articleData.article : null;
  const articleTags = articleData?.success ? articleData.tags : [];
  const feedbackStats = articleData?.success ? articleData.feedbackStats : { helpful: 0, notHelpful: 0 };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // The search is already triggered by the query
  };

  const handleArticleClick = (id: number) => {
    setSelectedArticleId(id);
  };

  const handleFeedback = async (isHelpful: boolean) => {
    try {
      const response = await fetch(`/api/knowledge-base/articles/${selectedArticleId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isHelpful,
          comment: '',
        }),
      });

      if (response.ok) {
        toast({
          title: "Feedback Submitted",
          description: "Thank you for your feedback!",
        });
      } else {
        throw new Error('Failed to submit feedback');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCategoryNameById = (id: number) => {
    const category = categories.find(cat => cat.id === id);
    return category ? category.name : 'Uncategorized';
  };

  const renderArticleCard = (article: KnowledgeArticle) => (
    <Card key={article.id} className="mb-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleArticleClick(article.id)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{article.title}</CardTitle>
        <CardDescription>
          <Badge variant="outline">{getCategoryNameById(article.categoryId)}</Badge>
          <span className="ml-2 text-xs text-gray-500">{new Date(article.createdAt).toLocaleDateString()}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-gray-700 line-clamp-2">
          {article.metaDescription || article.content.substring(0, 150)}...
        </p>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-gray-500">
        {article.viewCount} views
      </CardFooter>
    </Card>
  );

  const renderSkeletonCards = () => {
    return Array(5).fill(0).map((_, index) => (
      <Card key={index} className="mb-4">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-[250px]" />
          <Skeleton className="h-4 w-[100px] mt-2" />
        </CardHeader>
        <CardContent className="pb-2">
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardContent>
        <CardFooter className="pt-0">
          <Skeleton className="h-3 w-[80px]" />
        </CardFooter>
      </Card>
    ));
  };

  const renderArticleDetail = () => {
    if (isLoadingArticle) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-[350px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      );
    }

    if (!article) {
      return (
        <Alert>
          <AlertTitle>No Article Selected</AlertTitle>
          <AlertDescription>
            Please select an article from the list to view its details.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div>
        <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
        <div className="flex items-center space-x-2 mb-4">
          <Badge variant="outline">{getCategoryNameById(article.categoryId)}</Badge>
          <span className="text-sm text-gray-500">
            {new Date(article.createdAt).toLocaleDateString()}
          </span>
          <span className="text-sm text-gray-500">{article.viewCount} views</span>
        </div>
        {articleTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {articleTags.map(tag => (
              <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
            ))}
          </div>
        )}
        <div className="prose max-w-none mb-8">
          {article.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Was this article helpful?</h3>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => handleFeedback(true)}
            >
              Yes ({feedbackStats.helpful})
            </Button>
            <Button
              variant="outline"
              onClick={() => handleFeedback(false)}
            >
              No ({feedbackStats.notHelpful})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Knowledge Base</h1>
      
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Search for articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Tabs defaultValue="all">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="all" className="flex-1">All Articles</TabsTrigger>
              <TabsTrigger value="categories" className="flex-1">Categories</TabsTrigger>
              {searchQuery.length > 2 && (
                <TabsTrigger value="search" className="flex-1">Search Results</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Recent Articles</h2>
              {isLoadingArticles ? renderSkeletonCards() : articles.map(renderArticleCard)}
              {articles.length === 0 && !isLoadingArticles && (
                <Alert>
                  <AlertTitle>No Articles</AlertTitle>
                  <AlertDescription>
                    There are no knowledge base articles available.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
            
            <TabsContent value="categories">
              <h2 className="text-xl font-semibold mb-4">Categories</h2>
              {isLoadingCategories ? (
                <div className="space-y-3">
                  {Array(5).fill(0).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map(category => (
                    <Card key={category.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="p-4">
                        <CardTitle className="text-md">{category.name}</CardTitle>
                        {category.description && (
                          <CardDescription>{category.description}</CardDescription>
                        )}
                      </CardHeader>
                    </Card>
                  ))}
                  {categories.length === 0 && (
                    <Alert>
                      <AlertTitle>No Categories</AlertTitle>
                      <AlertDescription>
                        There are no knowledge base categories available.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </TabsContent>
            
            {searchQuery.length > 2 && (
              <TabsContent value="search">
                <h2 className="text-xl font-semibold mb-4">
                  Search Results for "{searchQuery}"
                </h2>
                {isLoadingSearch ? renderSkeletonCards() : searchResults.map(renderArticleCard)}
                {searchResults.length === 0 && !isLoadingSearch && (
                  <Alert>
                    <AlertTitle>No Results</AlertTitle>
                    <AlertDescription>
                      No articles found for your search query. Try using different keywords.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
        
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
            </CardHeader>
            <CardContent>
              {renderArticleDetail()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;