import classNames from "classnames";

export function Section(props: {
  children: React.ReactNode;
  className?: string;
  grid?: boolean;
}) {
  return (
    <div
      className={classNames(
        props.grid ? "grid grid-cols-2 gap-3 pt-6" : "pt-4 space-y-1",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
