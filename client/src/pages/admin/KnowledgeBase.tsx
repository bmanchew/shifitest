import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Edit, Trash2, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@lib/queryClient";

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

const KnowledgeBaseAdmin: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('articles');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategory | null>(null);
  const [editingTag, setEditingTag] = useState<KnowledgeTag | null>(null);
  const [articleFormData, setArticleFormData] = useState({
    title: '',
    content: '',
    categoryId: '',
    metaDescription: '',
    isPublished: false,
    slug: '',
    tags: [] as number[]
  });
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    slug: '',
    order: 0
  });
  const [tagFormData, setTagFormData] = useState({
    name: '',
    description: '',
    slug: ''
  });

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

  // Fetch all tags
  const { data: tagsData, isLoading: isLoadingTags } = useQuery({
    queryKey: ['/api/knowledge-base/tags'],
    retry: 1
  });

  // Fetch search results when search query changes
  const { data: searchData, isLoading: isLoadingSearch } = useQuery({
    queryKey: ['/api/knowledge-base/search', { query: searchQuery }],
    enabled: searchQuery.length > 2 && activeTab === 'articles',
    retry: 1
  });

  const articles = articlesData?.success ? articlesData.articles : [];
  const categories = categoriesData?.success ? categoriesData.categories : [];
  const tags = tagsData?.success ? tagsData.tags : [];
  const searchResults = searchData?.success ? searchData.articles : [];

  // Mutations
  const createArticleMutation = useMutation({
    mutationFn: (articleData: any) => 
      apiRequest('/api/knowledge-base/articles', {
        method: 'POST',
        data: articleData
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({
        title: "Success",
        description: "Article created successfully",
      });
      setShowArticleForm(false);
      resetArticleForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create article: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateArticleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      apiRequest(`/api/knowledge-base/articles/${id}`, {
        method: 'PATCH',
        data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/articles'] });
      toast({
        title: "Success",
        description: "Article updated successfully",
      });
      setShowArticleForm(false);
      resetArticleForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update article: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (categoryData: any) => 
      apiRequest('/api/knowledge-base/categories', {
        method: 'POST',
        data: categoryData
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      setShowCategoryForm(false);
      resetCategoryForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create category: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      apiRequest(`/api/knowledge-base/categories/${id}`, {
        method: 'PATCH',
        data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/categories'] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      setShowCategoryForm(false);
      resetCategoryForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update category: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const createTagMutation = useMutation({
    mutationFn: (tagData: any) => 
      apiRequest('/api/knowledge-base/tags', {
        method: 'POST',
        data: tagData
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/tags'] });
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
      setShowTagForm(false);
      resetTagForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to create tag: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => 
      apiRequest(`/api/knowledge-base/tags/${id}`, {
        method: 'PATCH',
        data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/tags'] });
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
      setShowTagForm(false);
      resetTagForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update tag: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by the query
  };

  const resetArticleForm = () => {
    setArticleFormData({
      title: '',
      content: '',
      categoryId: '',
      metaDescription: '',
      isPublished: false,
      slug: '',
      tags: []
    });
    setEditingArticle(null);
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: '',
      description: '',
      slug: '',
      order: 0
    });
    setEditingCategory(null);
  };

  const resetTagForm = () => {
    setTagFormData({
      name: '',
      description: '',
      slug: ''
    });
    setEditingTag(null);
  };

  const openArticleForm = (article?: KnowledgeArticle) => {
    if (article) {
      setEditingArticle(article);
      setArticleFormData({
        title: article.title,
        content: article.content,
        categoryId: article.categoryId.toString(),
        metaDescription: article.metaDescription || '',
        isPublished: article.isPublished,
        slug: article.slug,
        tags: [] // We'd need to fetch the article's tags from the API
      });
    } else {
      resetArticleForm();
    }
    setShowArticleForm(true);
  };

  const openCategoryForm = (category?: KnowledgeCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        slug: category.slug,
        order: category.order
      });
    } else {
      resetCategoryForm();
    }
    setShowCategoryForm(true);
  };

  const openTagForm = (tag?: KnowledgeTag) => {
    if (tag) {
      setEditingTag(tag);
      setTagFormData({
        name: tag.name,
        description: tag.description || '',
        slug: tag.slug
      });
    } else {
      resetTagForm();
    }
    setShowTagForm(true);
  };

  const handleArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = {
      ...articleFormData,
      categoryId: parseInt(articleFormData.categoryId)
    };
    
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data: formData });
    } else {
      createArticleMutation.mutate(formData);
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryFormData });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTag) {
      updateTagMutation.mutate({ id: editingTag.id, data: tagFormData });
    } else {
      createTagMutation.mutate(tagFormData);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleArticleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setArticleFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug === '' || prev.slug === generateSlug(prev.title) ? generateSlug(title) : prev.slug
    }));
  };

  const handleCategoryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCategoryFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug
    }));
  };

  const handleTagNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTagFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug
    }));
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Knowledge Base Management</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        
        <TabsContent value="articles">
          <div className="flex justify-between items-center mb-6">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>
            
            <Button onClick={() => openArticleForm()}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Articles</CardTitle>
              <CardDescription>Manage your knowledge base articles</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(searchQuery && searchQuery.length > 2 ? searchResults : articles).map((article: KnowledgeArticle) => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell>
                        {categories.find(c => c.id === article.categoryId)?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {article.isPublished ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>{article.viewCount}</TableCell>
                      <TableCell>{new Date(article.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" onClick={() => openArticleForm(article)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(searchQuery && searchQuery.length > 2 ? searchResults.length === 0 : articles.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        No articles found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Dialog open={showArticleForm} onOpenChange={setShowArticleForm}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingArticle ? 'Edit Article' : 'Create New Article'}</DialogTitle>
                <DialogDescription>
                  {editingArticle 
                    ? 'Update the article details below' 
                    : 'Fill in the details to create a new knowledge base article'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleArticleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">Title</Label>
                    <Input
                      id="title"
                      value={articleFormData.title}
                      onChange={handleArticleTitleChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="slug" className="text-right">Slug</Label>
                    <Input
                      id="slug"
                      value={articleFormData.slug}
                      onChange={(e) => setArticleFormData({...articleFormData, slug: e.target.value})}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category</Label>
                    <Select 
                      value={articleFormData.categoryId} 
                      onValueChange={(value) => setArticleFormData({...articleFormData, categoryId: value})}
                      required
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="content" className="text-right">Content</Label>
                    <Textarea
                      id="content"
                      value={articleFormData.content}
                      onChange={(e) => setArticleFormData({...articleFormData, content: e.target.value})}
                      className="col-span-3 min-h-[200px]"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="metaDescription" className="text-right">Meta Description</Label>
                    <Textarea
                      id="metaDescription"
                      value={articleFormData.metaDescription}
                      onChange={(e) => setArticleFormData({...articleFormData, metaDescription: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="text-right">Status</div>
                    <div className="flex items-center space-x-2 col-span-3">
                      <Checkbox
                        id="isPublished"
                        checked={articleFormData.isPublished}
                        onCheckedChange={(checked) => 
                          setArticleFormData({...articleFormData, isPublished: checked as boolean})
                        }
                      />
                      <Label htmlFor="isPublished">Published</Label>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowArticleForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingArticle ? 'Update Article' : 'Create Article'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        <TabsContent value="categories">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Knowledge Base Categories</h2>
            <Button onClick={() => openCategoryForm()}>
              <Plus className="h-4 w-4 mr-2" />
              New Category
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.slug}</TableCell>
                      <TableCell>{category.description || '-'}</TableCell>
                      <TableCell>{category.order}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openCategoryForm(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No categories found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Edit Category' : 'Create New Category'}</DialogTitle>
                <DialogDescription>
                  {editingCategory 
                    ? 'Update the category details below' 
                    : 'Fill in the details to create a new knowledge base category'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCategorySubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                      id="name"
                      value={categoryFormData.name}
                      onChange={handleCategoryNameChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="categorySlug" className="text-right">Slug</Label>
                    <Input
                      id="categorySlug"
                      value={categoryFormData.slug}
                      onChange={(e) => setCategoryFormData({...categoryFormData, slug: e.target.value})}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea
                      id="description"
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData({...categoryFormData, description: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="order" className="text-right">Order</Label>
                    <Input
                      id="order"
                      type="number"
                      value={categoryFormData.order}
                      onChange={(e) => setCategoryFormData({...categoryFormData, order: parseInt(e.target.value)})}
                      className="col-span-3"
                      required
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowCategoryForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCategory ? 'Update Category' : 'Create Category'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        <TabsContent value="tags">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Knowledge Base Tags</h2>
            <Button onClick={() => openTagForm()}>
              <Plus className="h-4 w-4 mr-2" />
              New Tag
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="font-medium">{tag.name}</TableCell>
                      <TableCell>{tag.slug}</TableCell>
                      <TableCell>{tag.description || '-'}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openTagForm(tag)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tags.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        No tags found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <Dialog open={showTagForm} onOpenChange={setShowTagForm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
                <DialogDescription>
                  {editingTag 
                    ? 'Update the tag details below' 
                    : 'Fill in the details to create a new knowledge base tag'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleTagSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tagName" className="text-right">Name</Label>
                    <Input
                      id="tagName"
                      value={tagFormData.name}
                      onChange={handleTagNameChange}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="tagSlug" className="text-right">Slug</Label>
                    <Input
                      id="tagSlug"
                      value={tagFormData.slug}
                      onChange={(e) => setTagFormData({...tagFormData, slug: e.target.value})}
                      className="col-span-3"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="tagDescription" className="text-right">Description</Label>
                    <Textarea
                      id="tagDescription"
                      value={tagFormData.description}
                      onChange={(e) => setTagFormData({...tagFormData, description: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowTagForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTag ? 'Update Tag' : 'Create Tag'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBaseAdmin;