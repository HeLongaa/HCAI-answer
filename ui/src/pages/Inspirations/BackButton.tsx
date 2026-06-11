import { FC, RefObject, useLayoutEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { createPortal } from 'react-dom';

interface InspirationBackButtonProps {
  anchorRef: RefObject<HTMLElement>;
  onClick: () => void;
  topOffset?: number;
}

const InspirationBackButton: FC<InspirationBackButtonProps> = ({
  anchorRef,
  onClick,
  topOffset = 16,
}) => {
  const [position, setPosition] = useState({ top: 88, left: 16 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: Math.max(88, rect.top + topOffset),
        left: Math.max(16, rect.left + 16),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (anchorRef.current) {
      observer.observe(anchorRef.current);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      observer.disconnect();
    };
  }, [anchorRef, topOffset]);

  return createPortal(
    <Button
      className="inspiration-back-button"
      style={position}
      type="button"
      variant="outline-secondary"
      onClick={onClick}>
      <i className="bi bi-chevron-left" />
      返回
    </Button>,
    document.body,
  );
};

export default InspirationBackButton;
