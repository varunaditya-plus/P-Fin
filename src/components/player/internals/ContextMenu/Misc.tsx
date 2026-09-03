export function Title(props: {
  children: React.ReactNode;
  rightSide?: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-bold text-video-context-type-main pb-3 pt-5 border-b border-video-context-border flex justify-between items-center">
        <div className="flex items-center space-x-3">{props.children}</div>
        <div>{props.rightSide}</div>
      </h3>
    </div>
  );
}

export function Divider() {
  return <hr className="!my-4 border-0 w-full h-px bg-video-context-border" />;
}

export function FieldTitle(props: { children: React.ReactNode }) {
  return <p className="font-medium">{props.children}</p>;
}

export function Paragraph(props: {
  children: React.ReactNode;
  marginClass?: string;
}) {
  return <p className={props.marginClass ?? "my-3"}>{props.children}</p>;
}
