import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all knowledge base articles (with optional filtering)
 */
router.get("/articles", async (req: Request, res: Response) => {
  try {
    const { category, tag, status, limit, offset } = req.query;
    
    // Validate query parameters
    const parsedLimit = limit ? parseInt(limit as string) : 20;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters"
      });
    }
    
    // Get all articles with options
    const options = {
      limit: parsedLimit,
      offset: parsedOffset,
      status: status as string
    };
    
    let articles = await storage.getAllKnowledgeBaseArticles(options);
    
    // Filter by category if provided
    if (category) {
      const categoryArticles = await storage.getKnowledgeBaseArticlesByCategory(category as string);
      const categoryArticleIds = new Set(categoryArticles.map(article => article.id));
      articles = articles.filter(article => categoryArticleIds.has(article.id));
    }
    
    // Filter by tag if provided
    if (tag) {
      const tagArticles = await storage.getKnowledgeBaseArticlesByTag(tag as string);
      const tagArticleIds = new Set(tagArticles.map(article => article.id));
      articles = articles.filter(article => tagArticleIds.has(article.id));
    }
    
    logger.info({
      message: `Retrieved ${articles.length} knowledge base articles`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        category,
        tag,
        status,
        limit: parsedLimit,
        offset: parsedOffset
      }
    });
    
    res.json({
      success: true,
      articles,
      count: articles.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving knowledge base articles: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve knowledge base articles"
    });
  }
});

/**
 * Get article by ID
 */
router.get("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID format"
      });
    }
    
    const article = await storage.getKnowledgeBaseArticle(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }
    
    // Increment view count
    await storage.updateKnowledgeBaseArticle(id, {
      viewCount: (article.viewCount || 0) + 1
    });
    
    // Get related tags
    const articleTags = await storage.getArticleTagsByArticleId(id);
    const tags = [];
    
    for (const articleTag of articleTags) {
      const tag = await storage.getKnowledgeTag(articleTag.tagId);
      if (tag) {
        tags.push(tag);
      }
    }
    
    // Get feedback stats
    const feedbackStats = await storage.getArticleFeedbackStats(id);
    
    res.json({
      success: true,
      article,
      tags,
      feedbackStats
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving article: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        articleId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve article"
    });
  }
});

/**
 * Create a new article
 */
router.post("/articles", async (req: Request, res: Response) => {
  try {
    // Create validation schema
    const articleSchema = z.object({
      title: z.string().min(3).max(255),
      content: z.string().min(10),
      categoryId: z.number().int().positive(),
      authorId: z.number().int().positive(),
      isPublished: z.boolean().optional().default(false),
      slug: z.string().min(3).max(255).optional(),
      metaDescription: z.string().max(255).optional(),
      tags: z.array(z.number().int().positive()).optional()
    });
    
    // Validate request body
    const validationResult = articleSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid article data",
        errors: validationResult.error.errors
      });
    }
    
    const articleData = validationResult.data;
    
    // Generate slug if not provided
    if (!articleData.slug) {
      articleData.slug = articleData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    // Extract tags before creating article
    const tags = articleData.tags || [];
    delete articleData.tags;
    
    // Create the article
    const newArticle = await storage.createKnowledgeBaseArticle({
      ...articleData,
      createdAt: new Date(),
      updatedAt: new Date(),
      viewCount: 0
    });
    
    // Associate tags with the new article
    const articleTags = [];
    for (const tagId of tags) {
      const articleTag = await storage.createArticleTag({
        articleId: newArticle.id,
        tagId
      });
      articleTags.push(articleTag);
    }
    
    // Log activity
    logger.info({
      message: `Created new knowledge base article: ${newArticle.title}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        articleId: newArticle.id,
        userId: req.user?.id
      }
    });
    
    res.status(201).json({
      success: true,
      article: newArticle,
      articleTags
    });
  } catch (error) {
    logger.error({
      message: `Error creating article: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create article"
    });
  }
});

/**
 * Update an article
 */
router.patch("/articles/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID format"
      });
    }
    
    // Verify article exists
    const existingArticle = await storage.getKnowledgeBaseArticle(id);
    if (!existingArticle) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }
    
    // Create validation schema for updates
    const articleUpdateSchema = z.object({
      title: z.string().min(3).max(255).optional(),
      content: z.string().min(10).optional(),
      categoryId: z.number().int().positive().optional(),
      isPublished: z.boolean().optional(),
      slug: z.string().min(3).max(255).optional(),
      metaDescription: z.string().max(255).optional(),
      tags: z.array(z.number().int().positive()).optional()
    });
    
    // Validate request body
    const validationResult = articleUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid article data",
        errors: validationResult.error.errors
      });
    }
    
    const articleData = validationResult.data;
    
    // Extract tags if provided
    const tags = articleData.tags;
    delete articleData.tags;
    
    // Update the article
    const updatedArticle = await storage.updateKnowledgeBaseArticle(id, {
      ...articleData,
      updatedAt: new Date()
    });
    
    // Update tags if provided
    if (tags) {
      // Get existing article tags
      const existingTags = await storage.getArticleTagsByArticleId(id);
      
      // Delete existing article tags
      for (const tag of existingTags) {
        await storage.deleteArticleTag(tag.id);
      }
      
      // Create new article tags
      for (const tagId of tags) {
        await storage.createArticleTag({
          articleId: id,
          tagId
        });
      }
    }
    
    logger.info({
      message: `Updated knowledge base article: ${updatedArticle?.title}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        articleId: id,
        userId: req.user?.id
      }
    });
    
    res.json({
      success: true,
      article: updatedArticle
    });
  } catch (error) {
    logger.error({
      message: `Error updating article: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        articleId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update article"
    });
  }
});

/**
 * Submit article feedback
 */
router.post("/articles/:id/feedback", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid article ID format"
      });
    }
    
    // Verify article exists
    const existingArticle = await storage.getKnowledgeBaseArticle(id);
    if (!existingArticle) {
      return res.status(404).json({
        success: false,
        message: "Article not found"
      });
    }
    
    // Create validation schema
    const feedbackSchema = z.object({
      isHelpful: z.boolean(),
      comment: z.string().max(500).optional(),
      userId: z.number().int().positive().optional()
    });
    
    // Validate request body
    const validationResult = feedbackSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback data",
        errors: validationResult.error.errors
      });
    }
    
    const feedbackData = validationResult.data;
    
    // Set userId if not provided
    if (!feedbackData.userId && req.user) {
      feedbackData.userId = req.user.id;
    }
    
    // Create the feedback
    const newFeedback = await storage.createArticleFeedback({
      ...feedbackData,
      articleId: id,
      createdAt: new Date()
    });
    
    // Get updated feedback stats
    const feedbackStats = await storage.getArticleFeedbackStats(id);
    
    res.status(201).json({
      success: true,
      feedback: newFeedback,
      feedbackStats
    });
  } catch (error) {
    logger.error({
      message: `Error submitting article feedback: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        articleId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to submit article feedback"
    });
  }
});

/**
 * Search knowledge base
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }
    
    const articles = await storage.searchKnowledgeBase(query);
    
    logger.info({
      message: `Searched knowledge base for: "${query}"`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        query,
        resultCount: articles.length
      }
    });
    
    res.json({
      success: true,
      articles,
      count: articles.length
    });
  } catch (error) {
    logger.error({
      message: `Error searching knowledge base: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        query: req.query.query,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to search knowledge base"
    });
  }
});

/**
 * Get all categories
 */
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await storage.getAllKnowledgeCategories();
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving knowledge categories: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve knowledge categories"
    });
  }
});

/**
 * Get category by ID
 */
router.get("/categories/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }
    
    const category = await storage.getKnowledgeCategory(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }
    
    res.json({
      success: true,
      category
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving knowledge category: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        categoryId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve knowledge category"
    });
  }
});

/**
 * Create a new category
 */
router.post("/categories", async (req: Request, res: Response) => {
  try {
    // Create validation schema
    const categorySchema = z.object({
      name: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
      slug: z.string().min(2).max(100).optional(),
      order: z.number().int().min(0).optional()
    });
    
    // Validate request body
    const validationResult = categorySchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid category data",
        errors: validationResult.error.errors
      });
    }
    
    const categoryData = validationResult.data;
    
    // Generate slug if not provided
    if (!categoryData.slug) {
      categoryData.slug = categoryData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    // Set default order if not provided
    if (categoryData.order === undefined) {
      const categories = await storage.getAllKnowledgeCategories();
      categoryData.order = categories.length;
    }
    
    // Create the category
    const newCategory = await storage.createKnowledgeCategory({
      ...categoryData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    logger.info({
      message: `Created new knowledge category: ${newCategory.name}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        categoryId: newCategory.id,
        userId: req.user?.id
      }
    });
    
    res.status(201).json({
      success: true,
      category: newCategory
    });
  } catch (error) {
    logger.error({
      message: `Error creating category: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create category"
    });
  }
});

/**
 * Update a category
 */
router.patch("/categories/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID format"
      });
    }
    
    // Verify category exists
    const existingCategory = await storage.getKnowledgeCategory(id);
    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }
    
    // Create validation schema for updates
    const categoryUpdateSchema = z.object({
      name: z.string().min(2).max(100).optional(),
      description: z.string().max(500).optional(),
      slug: z.string().min(2).max(100).optional(),
      order: z.number().int().min(0).optional()
    });
    
    // Validate request body
    const validationResult = categoryUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid category data",
        errors: validationResult.error.errors
      });
    }
    
    const categoryData = validationResult.data;
    
    // Update the category
    const updatedCategory = await storage.updateKnowledgeCategory(id, {
      ...categoryData,
      updatedAt: new Date()
    });
    
    logger.info({
      message: `Updated knowledge category: ${updatedCategory?.name}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        categoryId: id,
        userId: req.user?.id
      }
    });
    
    res.json({
      success: true,
      category: updatedCategory
    });
  } catch (error) {
    logger.error({
      message: `Error updating category: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        categoryId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to update category"
    });
  }
});

/**
 * Get all tags
 */
router.get("/tags", async (req: Request, res: Response) => {
  try {
    const tags = await storage.getAllKnowledgeTags();
    
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving knowledge tags: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve knowledge tags"
    });
  }
});

/**
 * Create a new tag
 */
router.post("/tags", async (req: Request, res: Response) => {
  try {
    // Create validation schema
    const tagSchema = z.object({
      name: z.string().min(2).max(50),
      slug: z.string().min(2).max(50).optional(),
      description: z.string().max(255).optional()
    });
    
    // Validate request body
    const validationResult = tagSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid tag data",
        errors: validationResult.error.errors
      });
    }
    
    const tagData = validationResult.data;
    
    // Generate slug if not provided
    if (!tagData.slug) {
      tagData.slug = tagData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    // Create the tag
    const newTag = await storage.createKnowledgeTag(tagData);
    
    logger.info({
      message: `Created new knowledge tag: ${newTag.name}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        tagId: newTag.id,
        userId: req.user?.id
      }
    });
    
    res.status(201).json({
      success: true,
      tag: newTag
    });
  } catch (error) {
    logger.error({
      message: `Error creating tag: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to create tag"
    });
  }
});

/**
 * Get suggested articles for a ticket
 */
router.get("/suggested-for-ticket/:ticketId", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID format"
      });
    }
    
    const articles = await storage.getSuggestedKnowledgeBaseArticles(ticketId);
    
    res.json({
      success: true,
      articles,
      count: articles.length
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving suggested articles: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "knowledge-base",
      metadata: {
        ticketId: req.params.ticketId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    res.status(500).json({
      success: false,
      message: "Failed to retrieve suggested articles"
    });
  }
});

export default router;