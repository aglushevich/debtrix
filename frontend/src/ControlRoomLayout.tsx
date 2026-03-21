import type { ReactNode } from "react";

type Props = {
  hero?: ReactNode;
  top?: ReactNode;
  main?: ReactNode;
  side?: ReactNode;
  bottom?: ReactNode;
};

export default function ControlRoomLayout({
  hero,
  top,
  main,
  side,
  bottom,
}: Props) {
  return (
    <div className="control-room-final-layout">
      {hero ? <div className="control-room-final-hero">{hero}</div> : null}
      {top ? <div className="control-room-final-top">{top}</div> : null}

      {(main || side) && (
        <div className="control-room-final-main-grid">
          <div className="control-room-final-main">{main}</div>
          <aside className="control-room-final-side">{side}</aside>
        </div>
      )}

      {bottom ? <div className="control-room-final-bottom">{bottom}</div> : null}
    </div>
  );
}