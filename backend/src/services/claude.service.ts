// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    if (!config.claude.apiKey) {
      console.warn('Claude API key not configured');
    }
    this.client = new Anthropic({
      apiKey: config.claude.apiKey
    });
  }

  async describeImageFromBase64(base64Data: string, context?: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada.', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      let base64Image = base64Data;
      let mediaType: MediaType = 'image/jpeg';

      if (base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mediaType = matches[1] as MediaType;
          base64Image = matches[2];
        }
      }

      const prompt = context || 'Describe en 1 frase corta que se ve.';

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Claude API error:', error);
      throw new AppError('Error IA: ' + (error as Error).message, 502, 'CLAUDE_ERROR');
    }
  }

  async describeImage(imagePath: string, context?: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      const ext = path.extname(imagePath).toLowerCase();
      let mediaType: MediaType = 'image/jpeg';
      if (ext === '.png') mediaType = 'image/png';
      else if (ext === '.webp') mediaType = 'image/webp';

      const prompt = context || 'Describe en 1 frase corta que se ve.';

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Claude API error:', error);
      throw new AppError('Error IA', 502, 'CLAUDE_ERROR');
    }
  }

  async describeImageFromUrl(imageUrl: string, context?: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new AppError('No se pudo descargar', 400, 'IMAGE_ERROR');
      }

      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const mediaType = contentType.split(';')[0] as MediaType;

      const prompt = context || 'Describe en 1 frase corta que se ve.';

      const claudeResponse = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ]
      });

      const textBlock = claudeResponse.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Claude API error:', error);
      throw new AppError('Error IA', 502, 'CLAUDE_ERROR');
    }
  }

  async generateReport(prompt: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Claude API error:', error);
      throw new AppError('Error IA: ' + (error as Error).message, 502, 'CLAUDE_ERROR');
    }
  }
}

export const claudeService = new ClaudeService();
