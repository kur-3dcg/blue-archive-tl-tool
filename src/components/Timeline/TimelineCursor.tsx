import { msToDisplay } from '../../utils/timeFormat';

interface Props {
  x: number;
  timeMs: number;
  visible: boolean;
  layerTop: number;
  layerBottom: number;
  dragY?: number;
}

export function TimelineCursor({ x, timeMs, visible, layerTop, layerBottom, dragY }: Props) {
  if (!visible) return null;

  const labelStyle = dragY !== undefined
    ? { left: x, top: dragY + 28 }
    : { left: x };

  return (
    <>
      <div
        className="timeline-cursor-line"
        style={{
          left: x,
          top: layerTop,
          height: layerBottom - layerTop,
        }}
      />
      <div
        className="timeline-cursor-label"
        style={labelStyle}
      >
        {msToDisplay(timeMs)}
      </div>
    </>
  );
}
