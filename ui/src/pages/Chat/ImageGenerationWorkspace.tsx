import { useEffect } from 'react';

import type { AiSubscriptionOverview } from '@/common/interface';
import PlaygroundApp from '@/pages/Chat/ImageGeneration/App';
import '@/pages/Chat/ImageGeneration/playground.css';

interface IProps {
  subscription: AiSubscriptionOverview | null;
  onRefreshSubscription: () => void;
  onOpenSubscription: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ImageGenerationWorkspace = (_props: IProps) => {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousDocumentOverscroll =
      document.documentElement.style.overscrollBehavior;

    return () => {
      document.body.classList.remove('select-none', 'drag-selecting');
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior =
        previousDocumentOverscroll;
    };
  }, []);

  return (
    <div
      id="image-playground"
      className="hcai-image-playground-shell"
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
      }}>
      <PlaygroundApp embedded />
    </div>
  );
};

export default ImageGenerationWorkspace;
