import secureLogger from '../shared/logger.js';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import { createPullRequest } from 'octokit-plugin-create-pull-request';
import * as fs from 'fs';
import * as path from 'path';

interface ErrorContext {
  error: Error | string;
  timestamp: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  requestBody?: any;
  stackTrace?: string;
  environment: string;
  version: string;
  responseTime?: number;
  statusCode?: number;
  memoryUsage?: any;
  queryTime?: number;
  query?: string;
  pattern?: string;
  responseBody?: any;
}

interface AIAnalysis {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'security' | 'performance' | 'functionality' | 'deployment' | 'database' | 'api';
  description: string;
  rootCause: string;
  suggestedFix: string;
  filesToModify: string[];
  codeChanges: Array<{
    file: string;
    changes: string;
    lineNumbers?: number[];
  }>;
  testingRecommendations: string[];
  priority: number;
}

interface PullRequestData {
  title: string;
  description: string;
  branch: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export class AIErrorHandler {
  private openai: OpenAI | undefined;
  private anthropic: Anthropic | undefined;
  private github: Octokit | undefined;
  private errorQueue: ErrorContext[] = [];
  private isProcessing = false;
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.initializeClients();
    this.startProcessingQueue();
  }

  private initializeClients() {
    try {
      // Initialize OpenAI client
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }

      // Initialize Anthropic client
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
      }

      // Initialize GitHub client
      if (process.env.GITHUB_TOKEN) {
        const MyOctokit = Octokit.plugin(createPullRequest);
        this.github = new MyOctokit({
          auth: process.env.GITHUB_TOKEN,
        });
      }

      secureLogger.info('AI Error Handler initialized', {
        openai: !!this.openai,
        anthropic: !!this.anthropic,
        github: !!this.github
      });
    } catch (error) {
      secureLogger.error('Failed to initialize AI Error Handler clients', { error: String(error) });
    }
  }

  public async captureError(error: Error | string, context?: Partial<ErrorContext>): Promise<void> {
    const errorContext: ErrorContext = {
      error,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...context
    };

    // Add to queue
    this.errorQueue.push(errorContext);

    // Log the error
    secureLogger.error('Error captured for AI analysis', {
      error: error instanceof Error ? error.message : error,
      context: errorContext
    });

    // Trim queue if too large
    if (this.errorQueue.length > this.MAX_QUEUE_SIZE) {
      this.errorQueue = this.errorQueue.slice(-this.MAX_QUEUE_SIZE);
    }
  }

  private async startProcessingQueue(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.errorQueue.length === 0) return;

      this.isProcessing = true;
      try {
        await this.processErrorQueue();
      } catch (error) {
        secureLogger.error('Error processing error queue', { error: String(error) });
      } finally {
        this.isProcessing = false;
      }
    }, this.PROCESSING_INTERVAL);
  }

  private async processErrorQueue(): Promise<void> {
    const errorsToProcess = [...this.errorQueue];
    this.errorQueue = [];

    for (const errorContext of errorsToProcess) {
      try {
        const analysis = await this.analyzeErrorWithAI(errorContext);

        if (analysis && analysis.severity !== 'low') {
          await this.createFixPullRequest(analysis, errorContext);
        }
      } catch (error) {
        secureLogger.error('Failed to process error with AI', {
          error: String(error),
          originalError: errorContext
        });
      }
    }
  }

  private async analyzeErrorWithAI(errorContext: ErrorContext): Promise<AIAnalysis | null> {
    try {
      const prompt = this.buildAnalysisPrompt(errorContext);

      // Try Claude first, then OpenAI as fallback
      let response = await this.analyzeWithClaude(prompt);
      if (!response) {
        response = await this.analyzeWithOpenAI(prompt);
      }

      if (response) {
        return this.parseAIAnalysis(response);
      }
    } catch (error) {
      secureLogger.error('AI analysis failed', { error: String(error), errorContext });
    }

    return null;
  }

  private async analyzeWithClaude(prompt: string): Promise<string | null> {
    if (!this.anthropic) return null;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text : null;
    } catch (error) {
      secureLogger.error('Claude API error', { error: String(error) });
      return null;
    }
  }

  private async analyzeWithOpenAI(prompt: string): Promise<string | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      secureLogger.error('OpenAI API error', { error: String(error) });
      return null;
    }
  }

  private parseAIAnalysis(response: string): AIAnalysis | null {
    try {
      // Extract JSON from AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate the analysis structure
      if (!analysis.severity || !analysis.category || !analysis.description) {
        throw new Error('Invalid analysis structure');
      }

      return {
        severity: analysis.severity,
        category: analysis.category,
        description: analysis.description,
        rootCause: analysis.rootCause || 'Unknown',
        suggestedFix: analysis.suggestedFix || 'No fix suggested',
        filesToModify: analysis.filesToModify || [],
        codeChanges: analysis.codeChanges || [],
        testingRecommendations: analysis.testingRecommendations || [],
        priority: analysis.priority || 5
      };
    } catch (error) {
      secureLogger.error('Failed to parse AI analysis', { error: String(error), response });
      return null;
    }
  }

  private async createFixPullRequest(analysis: AIAnalysis, errorContext: ErrorContext): Promise<void> {
    if (!this.github) return;

    try {
      const branchName = `ai-fix-${Date.now()}`;
      const title = `AI Fix: ${analysis.description}`;
      const body = this.generatePRDescription(analysis, errorContext);

      // Create pull request with suggested changes
      await this.github.rest.pulls.create({
        owner: process.env.GITHUB_OWNER!,
        repo: process.env.GITHUB_REPO!,
        title,
        body,
        head: branchName,
        base: 'main'
      });

      secureLogger.info('Fix pull request created', {
        title,
        severity: analysis.severity,
        category: analysis.category
      });
    } catch (error) {
      secureLogger.error('Failed to create fix PR', { error: String(error) });
    }
  }

  private generatePRDescription(analysis: AIAnalysis, errorContext: ErrorContext): string {
    return `
## AI-Generated Error Fix

**Error:** ${errorContext.error}
**Severity:** ${analysis.severity}
**Category:** ${analysis.category}
**Priority:** ${analysis.priority}/10

### Root Cause
${analysis.rootCause}

### Suggested Fix
${analysis.suggestedFix}

### Files to Modify
${analysis.filesToModify.map(file => `- ${file}`).join('\n')}

### Code Changes
${analysis.codeChanges.map(change => `
**File:** ${change.file}
\`\`\`
${change.changes}
\`\`\`
`).join('\n')}

### Testing Recommendations
${analysis.testingRecommendations.map(rec => `- ${rec}`).join('\n')}

---
*This PR was automatically generated by the UPP AI Error Handler*
    `;
  }

  private buildAnalysisPrompt(errorContext: ErrorContext): string {
    const errorMessage = errorContext.error instanceof Error
      ? errorContext.error.message
      : errorContext.error;

    const stackTrace = errorContext.error instanceof Error
      ? errorContext.error.stack
      : errorContext.stackTrace;

    return `
You are an expert software engineer and DevOps specialist. Analyze this error and provide a comprehensive fix.

ERROR CONTEXT:
- Error: ${errorMessage}
- Timestamp: ${errorContext.timestamp}
- Environment: ${errorContext.environment}
- Version: ${errorContext.version}
- Endpoint: ${errorContext.endpoint || 'N/A'}
- Method: ${errorContext.method || 'N/A'}
- User Agent: ${errorContext.userAgent || 'N/A'}
- IP: ${errorContext.ip || 'N/A'}
- Request Body: ${JSON.stringify(errorContext.requestBody || {}, null, 2)}

STACK TRACE:
${stackTrace || 'No stack trace available'}

PROJECT STRUCTURE:
This is a Node.js/TypeScript Universal Payment Protocol application with the following structure:
- server/index.ts (main server file)
- src/ (source code)
- dist/ (compiled code)
- package.json (dependencies and scripts)

ANALYSIS REQUIREMENTS:
1. Determine error severity (low/medium/high/critical)
2. Categorize the error (security/performance/functionality/deployment/database/api)
3. Identify root cause
4. Provide detailed fix with code changes
5. Suggest testing recommendations
6. Assign priority (1-10, 10 being highest)

Return your analysis as a JSON object with this exact structure:
{
  "severity": "low|medium|high|critical",
  "category": "security|performance|functionality|deployment|database|api",
  "description": "Brief description of the error",
  "rootCause": "Detailed explanation of what caused the error",
  "suggestedFix": "Step-by-step fix instructions",
  "filesToModify": ["list", "of", "files", "to", "modify"],
  "codeChanges": [
    {
      "file": "path/to/file",
      "changes": "code changes to make",
      "lineNumbers": [10, 15, 20]
    }
  ],
  "testingRecommendations": ["list", "of", "testing", "steps"],
  "priority": 1-10
}
    `;
  }
}

// Global instance
export const aiErrorHandler = new AIErrorHandler();