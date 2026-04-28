export interface GenerationProgress {
  type: 'progress' | 'image_ready' | 'complete' | 'error' | 'status';
  current?: number;
  total?: number;
  message?: string;
  image?: any;
  error?: string;
  creditsUsed?: number;
  remainingBalance?: number;
}

export const triggerGeneration = async (
  prompt: string, 
  userId: string, 
  idToken: string,
  onEvent: (event: GenerationProgress) => void,
  title?: string,
  promptSetID?: string,
  variables?: Record<string, { value: string, default: string }>,
  template?: string,
  quality: string = 'standard',
  referenceImages?: Array<{ data: string, mimeType: string, title?: string }>,
  signal?: AbortSignal
) => {
  try {
    const API_URL = import.meta.env.VITE_PROMPTTOOL_API_URL || '/api/generate';
    console.log('[Generation Service] Dispatching Request:', {
        prompt,
        uid: userId,
        title,
        promptSetID,
        quality,
        variables,
        template,
        referenceImages
    });

    const response = await fetch(API_URL, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        prompt,
        uid: userId,
        title: title, 
        promptSetID: promptSetID, 
        quality,
        aspectRatio: '16:9',
        promptType: 'freeform',
        count: 1,
        modality: 'image',
        variables, 
        template, 
        referenceImages
      }),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(data);
          } catch (e) {
            console.error('Error parsing SSE data', e);
          }
        }
      }
    }
  } catch (error: any) {
    onEvent({ type: 'error', error: error.message });
  }
};
