import { FC, RefObject, useLayoutEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { createPortal } from 'react-dom';

interface InspirationBackButtonProps {
  anchorRef?: RefObject<HTMLElement>;
  inline?: boolean;
  leftOffset?: number;
  onClick: () => void;
  topOffset?: number;
}

const InspirationBackButton: FC<InspirationBackButtonProps> = ({
  anchorRef,
  inline = false,
  leftOffset = 16,
  onClick,
  topOffset = 16,
}) => {
  const [position, setPosition] = useState({ top: 88, left: 16 });

  useLayoutEffect(() => {
    if (inline) {
      return undefined;
    }

    let frameID = 0;
    let settleCount = 0;
    const updatePosition = () => {
      const anchor = anchorRef?.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const nextPosition = {
        top: Math.max(88, rect.top + topOffset),
        left: Math.max(16, rect.left + leftOffset),
      };
      setPosition((prev) => {
        if (prev.top === nextPosition.top && prev.left === nextPosition.left) {
          return prev;
        }
        return nextPosition;
      });
    };

    const settlePosition = () => {
      updatePosition();
      settleCount += 1;
      if (settleCount < 30) {
        frameID = window.requestAnimationFrame(settlePosition);
      }
    };

    frameID = window.requestAnimationFrame(settlePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('load', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (anchorRef?.current) {
      observer.observe(anchorRef.current);
      if (anchorRef.current.parentElement) {
        observer.observe(anchorRef.current.parentElement);
      }
    }
    observer.observe(document.body);

    return () => {
      window.cancelAnimationFrame(frameID);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('load', updatePosition);
      observer.disconnect();
    };
  }, [anchorRef, inline, leftOffset, topOffset]);

  const button = (
    <Button
      className="inspiration-back-button"
      style={inline ? undefined : position}
      type="button"
      variant="outline-secondary"
      onClick={onClick}>
      <i className="bi bi-chevron-left" />
      返回
    </Button>
  );

  if (inline) {
    return button;
  }

  return createPortal(button, document.body);
};

export default InspirationBackButton;
