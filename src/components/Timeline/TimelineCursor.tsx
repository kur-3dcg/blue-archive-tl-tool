interface Props {
  x: number;
  timeMs: number;
  visible: boolean;
  layerTop: number;
  layerBottom: number;
  dragY?: number;
}

export function TimelineCursor({ x, visible, layerTop, layerBottom }: Props) {
  if (!visible) return null;

  return (
    <div
      className="timeline-cursor-line"
      style={{
        left: x,
        top: layerTop,
        height: layerBottom - layerTop,
      }}
    />
  );
}
