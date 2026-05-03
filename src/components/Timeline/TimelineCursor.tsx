import { msToDisplay } from '../../utils/timeFormat';

interface Props {
  x: number;
  timeMs: number;
  visible: boolean;
  layerTop: number;
  layerBottom: number;
}

export function TimelineCursor({ x, timeMs, visible, layerTop, layerBottom }: Props) {
  if (!visible) return null;

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
        style={{ left: x }}
      >
        {msToDisplay(timeMs)}
      </div>
    </>
  );
}
