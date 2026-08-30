import classNames from "classnames";
import { useId } from "react";

import { TextInputControl } from "./TextInputControl";

export function AuthInputBox(props: {
  value?: string;
  label?: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  onChange?: (data: string) => void;
  passwordToggleable?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={classNames("space-y-3", props.className)}>
      {props.label ? (
        <label htmlFor={id} className="block font-bold text-white">
          {props.label}
        </label>
      ) : null}
      <TextInputControl
        id={id}
        name={props.name}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={props.onChange}
        placeholder={props.placeholder}
        passwordToggleable={props.passwordToggleable}
        className="w-full flex-1 bg-authentication-inputBg px-4 py-3 text-search-text focus:outline-none rounded-lg placeholder:text-gray-700"
      />
    </div>
  );
}
