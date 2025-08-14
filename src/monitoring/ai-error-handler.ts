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
  private openaiClient: any;
  private anthropicClient: any;
  private octokit: any;
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
        this.openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }

      // Initialize Anthropic client
      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropicClient = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
      }

      // Initialize GitHub client
      if (process.env.GITHUB_TOKEN) {
        this.octokit = new Octokit({
          auth: process.env.GITHUB_TOKEN,
        });
        this.octokit = this.octokit.plugin(createPullRequest);
      }

      secureLogger.info('AI Error Handler initialized', {
        openai: !!this.openaiClient,
        anthropic: !!this.anthropicClient,
        github: !!this.octokit
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

RESPONSE FORMAT (JSON):
{
  "severity": "high",
  "category": "functionality",
  "description": "Brief description of the issue",
  "rootCause": "Detailed explanation of what caused the error",
  "suggestedFix": "Step-by-step fix description",
  "filesToModify": ["file1.ts", "file2.ts"],
  "codeChanges": [
    {
      "file": "server/index.ts",
      "changes": "// Add error handling\nif (error) {\n  console.error('Error:', error);\n}",
      "lineNumbers": [10, 15]
    }
  ],
  "testingRecommendations": ["Test the specific endpoint", "Add unit tests"],
  "priority": 8
}

Provide only the JSON response, no additional text.
`;
  }

  private async analyzeWithClaude(prompt: string): Promise<string | null> {
    if (!this.anthropicClient) return null;

    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].text;
    } catch (error) {
      secureLogger.error('Claude analysis failed', { error: String(error) });
      return null;
    }
  }

  private async analyzeWithOpenAI(prompt: string): Promise<string | null> {
    if (!this.openaiClient) return null;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer. Provide only JSON responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      });

      return response.choices[0].message.content;
    } catch (error) {
      secureLogger.error('OpenAI analysis failed', { error: String(error) });
      return null;
    }
  }

  private parseAIAnalysis(response: string): AIAnalysis | null {
    try {
      // Clean the response - remove control characters and extra whitespace
      let cleanedResponse = response
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\n\s*\n/g, '\n') // Remove extra newlines
        .trim();

      // Extract JSON from response (in case there's extra text)
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        secureLogger.warn('No JSON found in AI response', { response: cleanedResponse.substring(0, 200) });
        return null;
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const requiredFields = ['severity', 'category', 'description', 'rootCause', 'suggestedFix', 'priority'];
      for (const field of requiredFields) {
        if (!analysis[field]) {
          secureLogger.warn('Invalid AI analysis response - missing field', { field, response: cleanedResponse.substring(0, 200) });
          return null;
        }
      }

      return analysis;
    } catch (error) {
      secureLogger.error('Failed to parse AI analysis', { 
        error: String(error), 
        response: response.substring(0, 500),
        responseLength: response.length
      });
      return null;
    }
  }

  private async createFixPullRequest(analysis: AIAnalysis, errorContext: ErrorContext): Promise<void> {
    if (!this.octokit) {
      secureLogger.warn('GitHub client not configured - skipping PR creation');
      return;
    }

    try {
      const prData = await this.generatePullRequestData(analysis, errorContext);
      
      if (prData.files.length === 0) {
        secureLogger.info('No files to modify - skipping PR creation');
        return;
      }

      const result = await this.octokit.createPullRequest({
        owner: process.env.GITHUB_OWNER || 'robertsn808',
        repo: process.env.GITHUB_REPO || 'UniversalPaymentProtocol',
        title: prData.title,
        body: prData.description,
        head: prData.branch,
        changes: prData.files.map(file => ({
          path: file.path,
          content: file.content
        }))
      });

      secureLogger.info('Pull request created successfully', {
        prNumber: result.data.number,
        prUrl: result.data.html_url,
        analysis: analysis
      });

    } catch (error) {
      secureLogger.error('Failed to create pull request', { error: String(error), analysis });
    }
  }

  private async generatePullRequestData(analysis: AIAnalysis, errorContext: ErrorContext): Promise<PullRequestData> {
    const branchName = `fix/ai-auto-fix-${Date.now()}`;
    const errorMessage = errorContext.error instanceof Error 
      ? errorContext.error.message 
      : errorContext.error;

    const title = `🤖 AI Auto-Fix: ${errorMessage.substring(0, 50)}...`;
    
    const description = `
## 🤖 AI-Generated Fix

**Error**: ${errorMessage}
**Severity**: ${analysis.severity.toUpperCase()}
**Category**: ${analysis.category}
**Priority**: ${analysis.priority}/10

### 📋 Analysis
${analysis.description}

### 🔍 Root Cause
${analysis.rootCause}

### 🛠️ Suggested Fix
${analysis.suggestedFix}

### 📁 Files Modified
${analysis.filesToModify.map(file => `- \`${file}\``).join('\n')}

### 🧪 Testing Recommendations
${analysis.testingRecommendations.map(rec => `- ${rec}`).join('\n')}

### 📊 Error Context
- **Timestamp**: ${errorContext.timestamp}
- **Environment**: ${errorContext.environment}
- **Endpoint**: ${errorContext.endpoint || 'N/A'}
- **Method**: ${errorContext.method || 'N/A'}

---
*This PR was automatically generated by the AI Error Handler system.*
`;

    const files: Array<{ path: string; content: string }> = [];

    // Generate file changes
    for (const change of analysis.codeChanges) {
      try {
        const filePath = change.file;
        const currentContent = fs.existsSync(filePath) 
          ? fs.readFileSync(filePath, 'utf8') 
          : '';

        const newContent = this.applyCodeChanges(currentContent, change);
        files.push({
          path: filePath,
          content: newContent
        });
      } catch (error) {
        secureLogger.error('Failed to generate file changes', { 
          file: change.file, 
          error: String(error)
        });
      }
    }

    return {
      title,
      description,
      branch: branchName,
      files
    };
  }

  private applyCodeChanges(currentContent: string, change: any): string {
    // Simple implementation - in production, you'd want more sophisticated diff/patch logic
    if (change.lineNumbers && change.lineNumbers.length === 2) {
      const [startLine, endLine] = change.lineNumbers;
      const lines = currentContent.split('\n');
      
      // Replace the specified lines
      const beforeLines = lines.slice(0, startLine - 1);
      const afterLines = lines.slice(endLine);
      const newLines = change.changes.split('\n');
      
      return [...beforeLines, ...newLines, ...afterLines].join('\n');
    } else {
      // Append to end of file
      return currentContent + '\n\n' + change.changes;
    }
  }

  public getStats() {
    return {
      queueSize: this.errorQueue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.MAX_QUEUE_SIZE,
      processingInterval: this.PROCESSING_INTERVAL
    };
  }
}

// Global instance
export const aiErrorHandler = new AIErrorHandler();
