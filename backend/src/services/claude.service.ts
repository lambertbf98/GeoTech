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

  async describeImage(imagePath: string, context?: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      // Leer imagen y convertir a base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Detectar tipo de imagen
      const ext = path.extname(imagePath).toLowerCase();
      let mediaType: MediaType = 'image/jpeg';
      if (ext === '.png') mediaType = 'image/png';
      else if (ext === '.webp') mediaType = 'image/webp';

      // Construir prompt
      let prompt = `Analiza esta imagen desde una perspectiva técnica de ingeniería civil.
Describe de manera profesional y concisa:
1. Qué elementos principales se observan
2. Estado general de lo visible (si aplica)
3. Características relevantes del terreno o construcción
4. Cualquier observación técnica de interés

Responde en español y de forma estructurada.`;

      if (context) {
        prompt = `${context}\n\nAnaliza esta imagen y proporciona una descripción técnica en español.`;
      }

      // Llamar a Claude API con modelo Haiku (más económico)
      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
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
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      // Extraer texto de la respuesta
      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada de Claude', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Claude API error:', error);
      throw new AppError('Error al procesar imagen con IA', 502, 'CLAUDE_ERROR');
    }
  }

  async describeImageFromUrl(imageUrl: string, context?: string): Promise<string> {
    if (!config.claude.apiKey) {
      throw new AppError('Claude API no configurada', 503, 'CLAUDE_NOT_CONFIGURED');
    }

    try {
      // Descargar imagen
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new AppError('No se pudo descargar la imagen', 400, 'IMAGE_DOWNLOAD_ERROR');
      }

      const buffer = await response.arrayBuffer();
      const base64Image = Buffer.from(buffer).toString('base64');

      // Detectar tipo de imagen del content-type
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const mediaType = contentType.split(';')[0] as MediaType;

      let prompt = `Analiza esta imagen desde una perspectiva técnica de ingeniería civil.
Describe de manera profesional y concisa los elementos observados.
Responde en español.`;

      if (context) {
        prompt = `${context}\n\nAnaliza esta imagen y proporciona una descripción técnica en español.`;
      }

      const claudeResponse = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
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
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const textBlock = claudeResponse.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Respuesta inesperada de Claude', 502, 'CLAUDE_ERROR');
      }

      return textBlock.text;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Claude API error:', error);
      throw new AppError('Error al procesar imagen con IA', 502, 'CLAUDE_ERROR');
    }
  }
}

export const claudeService = new ClaudeService();
