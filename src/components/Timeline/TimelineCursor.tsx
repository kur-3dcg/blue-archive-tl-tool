import { msToDisplay } from '../../utils/timeFormat';

interface Props {
  x: number;
  timeMs: number;
  visible: boolean;
  layerTop: number;
  layerBottom: number;
  dragY?: number;
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
      {/* マウス位置の時間ラベル（時間目盛り上に表示） */}
      <div
        className="timeline-cursor-label"
        style={{ left: x }}
      >
        {msToDisplay(timeMs)}
      </div>
    </>
  );
}
