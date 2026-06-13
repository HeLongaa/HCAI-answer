const PENDING_IMAGE_PROMPT_KEY = 'hcai_pending_image_generation_prompt';
export const PENDING_IMAGE_PROMPT_EVENT = 'hcai-use-image-generation-prompt';

interface PendingImagePrompt {
  prompt: string;
  createdAt: number;
}

export const savePendingImagePrompt = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }
  const payload: PendingImagePrompt = {
    prompt: trimmed,
    createdAt: Date.now(),
  };
  window.localStorage.setItem(PENDING_IMAGE_PROMPT_KEY, JSON.stringify(payload));
  window.dispatchEvent(
    new CustomEvent(PENDING_IMAGE_PROMPT_EVENT, {
      detail: { prompt: trimmed },
    }),
  );
};

export const consumePendingImagePrompt = () => {
  const raw = window.localStorage.getItem(PENDING_IMAGE_PROMPT_KEY);
  if (!raw) {
    return '';
  }
  window.localStorage.removeItem(PENDING_IMAGE_PROMPT_KEY);
  try {
    const payload = JSON.parse(raw) as Partial<PendingImagePrompt>;
    if (Date.now() - Number(payload.createdAt || 0) > 5 * 60 * 1000) {
      return '';
    }
    return typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  } catch {
    return '';
  }
};
