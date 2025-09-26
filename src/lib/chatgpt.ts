// src/lib/chatgpt.ts
import { logger } from './logger.js';

export interface SimilarSong {
  title: string;
  artist: string;
  genre?: string;
  reason?: string;
}

export interface ChatGPTResponse {
  songs: SimilarSong[];
  genre?: string;
  mood?: string;
}

export class ChatGPTService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!this.apiKey) {
      logger.warn('[chatgpt] No OpenAI API key found. Radio features will be limited.');
    }
  }

  /**
   * Generate similar songs based on a reference track
   */
  async generateSimilarSongs(
    referenceTrack: {
      title: string;
      artist: string;
      genre?: string;
      mood?: string;
    },
    count: number = 5
  ): Promise<ChatGPTResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildSimilarSongsPrompt(referenceTrack, count);
    
    try {
      const response = await this.callOpenAI(prompt);
      return this.parseSimilarSongsResponse(response);
    } catch (error) {
      logger.error('[chatgpt] Failed to generate similar songs', { error, referenceTrack });
      throw error;
    }
  }

  /**
   * Generate a radio playlist based on a seed track
   */
  async generateRadioPlaylist(
    seedTrack: {
      title: string;
      artist: string;
      genre?: string;
    },
    count: number = 10
  ): Promise<ChatGPTResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildRadioPlaylistPrompt(seedTrack, count);
    
    try {
      const response = await this.callOpenAI(prompt);
      return this.parseSimilarSongsResponse(response);
    } catch (error) {
      logger.error('[chatgpt] Failed to generate radio playlist', { error, seedTrack });
      throw error;
    }
  }

  /**
   * Analyze a track to determine its genre and mood
   */
  async analyzeTrack(track: { title: string; artist: string }): Promise<{ genre?: string; mood?: string; description?: string }> {
    if (!this.apiKey) {
      return { genre: 'Unknown', mood: 'Unknown' };
    }

    const prompt = `Analyze this song and provide its genre, mood, and a brief description:

Song: "${track.title}" by ${track.artist}

Please respond in JSON format:
{
  "genre": "primary genre",
  "mood": "emotional mood/vibe",
  "description": "brief description of the song's style and characteristics"
}`;

    try {
      const response = await this.callOpenAI(prompt);
      return JSON.parse(response);
    } catch (error) {
      logger.error('[chatgpt] Failed to analyze track', { error, track });
      return { genre: 'Unknown', mood: 'Unknown' };
    }
  }

  private buildSimilarSongsPrompt(track: { title: string; artist: string; genre?: string; mood?: string }, count: number): string {
    return `You are a music expert. Based on the song "${track.title}" by ${track.artist}${track.genre ? ` (Genre: ${track.genre})` : ''}${track.mood ? ` (Mood: ${track.mood})` : ''}, suggest ${count} similar songs that would fit well in the same playlist.

Please respond with a JSON object in this exact format:
{
  "genre": "primary genre of the reference song",
  "mood": "emotional mood/vibe",
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "reason": "Why this song is similar (style, mood, genre, etc.)"
    }
  ]
}

Focus on songs that share similar:
- Musical style and genre
- Emotional tone and mood
- Instrumentation and production
- Era or movement
- Target audience

Make sure the songs are well-known and easily searchable on YouTube.`;
  }

  private buildRadioPlaylistPrompt(track: { title: string; artist: string; genre?: string }, count: number): string {
    return `Create a radio-style playlist based on "${track.title}" by ${track.artist}${track.genre ? ` (Genre: ${track.genre})` : ''}.

Generate ${count} songs that would work well in a continuous radio playlist, including:
- The seed song and similar tracks
- Some variety to keep it interesting
- Songs that flow well together
- Mix of popular and lesser-known tracks

Please respond with a JSON object in this exact format:
{
  "genre": "primary genre",
  "mood": "overall mood of the playlist",
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "reason": "Why this fits in the playlist"
    }
  ]
}

Make sure all songs are searchable on YouTube and would create a cohesive listening experience.`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || '';
  }

  private parseSimilarSongsResponse(response: string): ChatGPTResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing if JSON is not found
      throw new Error('No valid JSON found in response');
    } catch (error) {
      logger.error('[chatgpt] Failed to parse response', { error, response });
      
      // Return a fallback response
      return {
        songs: [
          {
            title: 'Unknown Song',
            artist: 'Unknown Artist',
            reason: 'Failed to parse AI response'
          }
        ],
        genre: 'Unknown',
        mood: 'Unknown'
      };
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export a singleton instance
export const chatGPTService = new ChatGPTService();
