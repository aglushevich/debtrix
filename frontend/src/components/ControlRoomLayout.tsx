import React from "react";

type Props = {
  children: React.ReactNode;
};

export default function ControlRoomLayout({ children }: Props) {
  return (
    <div className="control-room">
      {children}
    </div>
  );
}